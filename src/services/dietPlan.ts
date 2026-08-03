import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { mealGroups as catalogueMealGroups } from '../data'
import type { DietMealId, ImportedDietMeal, ImportedDietPlan, MealGroup } from '../types'

const sectionConfig: Array<{ id: DietMealId; title: string; titleAr: string; share: number; pattern: RegExp; hints: RegExp }> = [
  { id: 'breakfast', title: 'Breakfast from PDF', titleAr: 'فطور من ملف PDF', share: 0.25, pattern: /^(?:breakfast|meal\s*1|الفطور|فطور|الوجبة\s*الأولى|وجبة\s*1)\s*[:\-–—]?\s*(.*)$/i, hints: /egg|oat|pancake|toast|labneh|cheese|بيض|شوفان|توست|لبنة|جبن/i },
  { id: 'snack', title: 'Snack from PDF', titleAr: 'وجبة خفيفة من ملف PDF', share: 0.15, pattern: /^(?:snack|meal\s*2|وجبة\s*خفيفة|سناك|الوجبة\s*الثانية|وجبة\s*2)\s*[:\-–—]?\s*(.*)$/i, hints: /snack|fruit|yogurt|bar|nuts|فاكهة|فواكه|زبادي|مكسرات|سناك/i },
  { id: 'lunch', title: 'Lunch from PDF', titleAr: 'غداء من ملف PDF', share: 0.35, pattern: /^(?:lunch|meal\s*3|الغداء|غداء|الوجبة\s*الثالثة|وجبة\s*3)\s*[:\-–—]?\s*(.*)$/i, hints: /chicken|beef|meat|rice|pasta|دجاج|لحمة|لحم|رز|أرز|معكرونة/i },
  { id: 'dinner', title: 'Dinner from PDF', titleAr: 'عشاء من ملف PDF', share: 0.25, pattern: /^(?:dinner|meal\s*4|العشاء|عشاء|الوجبة\s*الرابعة|وجبة\s*4)\s*[:\-–—]?\s*(.*)$/i, hints: /fish|tuna|salad|soup|shrimp|سمك|تونا|سلطة|شوربة|قريدس/i },
]

function tidyLine(line: string) {
  return line.replace(/^[\s•·▪◦*–—-]+/, '').replace(/\s+/g, ' ').trim()
}

function clampMetric(value: number | undefined, min: number, max: number, fallback: number) {
  return value && value >= min && value <= max ? Math.round(value) : fallback
}

function metricNearLabel(text: string, labels: string, min: number, max: number) {
  const after = text.match(new RegExp(`(?:${labels})[^0-9]{0,18}([0-9]{1,4}(?:\\.[0-9]+)?)`, 'i'))
  const before = text.match(new RegExp(`([0-9]{1,4}(?:\\.[0-9]+)?)\\s*(?:g|grams?|غم|غ)?\\s*(?:${labels})`, 'i'))
  const value = Number(after?.[1] ?? before?.[1])
  return Number.isFinite(value) && value >= min && value <= max ? value : undefined
}

function caloriesInLines(lines: string[]) {
  return lines.reduce((sum, line) => {
    const match = line.match(/([0-9]{2,4})\s*(?:kcal|calories?|سعرة|سعرات|كالوري)/i)
    return sum + (match ? Number(match[1]) : 0)
  }, 0)
}

function macroInLines(lines: string[], label: string) {
  return lines.reduce((sum, line) => {
    const match = line.match(new RegExp(`([0-9]{1,3}(?:\\.[0-9]+)?)\\s*(?:g|grams?|غم|غ)\\s*(?:${label})`, 'i'))
    return sum + (match ? Number(match[1]) : 0)
  }, 0)
}

function splitIntoLines(text: string) {
  const withHeaders = text
    .replace(/\s+(?=(?:breakfast|snack|lunch|dinner|meal\s*[1-4])\s*[:\-–—])/gi, '\n')
    .replace(/\s+(?=(?:الفطور|فطور|وجبة\s*خفيفة|سناك|الغداء|غداء|العشاء|عشاء)\s*[:\-–—])/g, '\n')
  return withHeaders.split(/\r?\n/).map(tidyLine).filter((line) => line.length > 1)
}

function extractSections(lines: string[], daily: { calories: number; protein: number; carbs: number; fat: number }) {
  const collected: Record<DietMealId, string[]> = { breakfast: [], snack: [], lunch: [], dinner: [] }
  let current: DietMealId | null = null

  lines.forEach((line) => {
    const heading = sectionConfig.map((config) => ({ config, match: line.match(config.pattern) })).find((item) => item.match)
    if (heading?.match) {
      current = heading.config.id
      const inline = tidyLine(heading.match[1] ?? '')
      if (inline) collected[current].push(inline)
      return
    }
    if (/^(?:notes?|avoid|allerg(?:y|ies)|instructions?|ملاحظات?|تجنب|حساسية|تعليمات)\s*[:\-–—]?/i.test(line)) {
      current = null
      return
    }
    if (current && !/^(?:daily|total|target|requirements?|calories?|protein|carbs?|fat|السعرات|البروتين|الكربوهيدرات|الدهون)/i.test(line)) {
      collected[current].push(line)
    }
  })

  if (Object.values(collected).every((items) => items.length === 0)) {
    const candidates = lines.filter((line) => line.length >= 4 && line.length <= 180 && !/[0-9]{3,4}\s*(?:kcal|calories?)/i.test(line))
    candidates.forEach((line) => {
      const inferred = sectionConfig.find((config) => config.hints.test(line))
      if (inferred && collected[inferred.id].length < 8) collected[inferred.id].push(line)
    })
    if (Object.values(collected).every((items) => items.length === 0)) {
      candidates.slice(0, 4).forEach((line, index) => collected[sectionConfig[index].id].push(line))
    }
  }

  return sectionConfig.map((config): ImportedDietMeal => {
    const items = [...new Set(collected[config.id].map(tidyLine).filter(Boolean))].slice(0, 12)
    const explicitCalories = caloriesInLines(items)
    const explicitProtein = macroInLines(items, 'protein|بروتين')
    const explicitCarbs = macroInLines(items, 'carbs?|carbohydrates?|كربوهيدرات|كارب')
    const explicitFat = macroInLines(items, 'fat|دهون')
    const firstDescriptiveLine = items.find((line) => !/[0-9]{2,4}\s*(?:kcal|calories?|سعرة|سعرات)/i.test(line))
    return {
      id: config.id,
      title: firstDescriptiveLine && firstDescriptiveLine.length <= 72 ? firstDescriptiveLine : config.title,
      items,
      calories: Math.round(explicitCalories || daily.calories * config.share),
      protein: Math.round(explicitProtein || daily.protein * config.share),
      carbs: Math.round(explicitCarbs || daily.carbs * config.share),
      fat: Math.round(explicitFat || daily.fat * config.share),
    }
  })
}

export async function parseDietPlanPdf(file: File): Promise<ImportedDietPlan> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Choose a PDF file.')
  if (file.size > 10 * 1024 * 1024) throw new Error('The PDF must be smaller than 10 MB.')

  const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pageTexts: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    let pageText = ''
    content.items.forEach((item) => {
      if (!('str' in item) || !item.str.trim()) return
      pageText += `${item.str}${item.hasEOL ? '\n' : ' '}`
    })
    pageTexts.push(pageText.trim())
  }

  const text = pageTexts.join('\n')
  if (text.replace(/\s/g, '').length < 25) throw new Error('No readable text was found. Upload a text-based PDF rather than a scanned image.')
  const dailyCalories = clampMetric(metricNearLabel(text, 'daily calories?|calorie target|kcal|السعرات(?: اليومية)?|سعرات(?: يومية)?', 800, 6000), 800, 6000, 1900)
  const protein = clampMetric(metricNearLabel(text, 'protein|بروتين', 20, 500), 20, 500, 150)
  const fat = clampMetric(metricNearLabel(text, 'fat|دهون', 15, 300), 15, 300, 65)
  const fallbackCarbs = Math.max(40, Math.round((dailyCalories - protein * 4 - fat * 9) / 4))
  const carbs = clampMetric(metricNearLabel(text, 'carbs?|carbohydrates?|كربوهيدرات|كارب', 20, 800), 20, 800, fallbackCarbs)
  const daily = { calories: dailyCalories, protein, carbs, fat }
  const lines = splitIntoLines(text)
  const notes = lines.filter((line) => /note|avoid|allerg|instruction|ملاحظة|تجنب|حساسية|تعليمات/i.test(line)).slice(0, 6)

  return {
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
    pageCount: pdf.numPages,
    extractedCharacters: text.length,
    dailyCalories,
    protein,
    carbs,
    fat,
    meals: extractSections(lines, daily),
    notes,
  }
}

export function buildMealGroups(plan?: ImportedDietPlan): MealGroup[] {
  if (!plan) return catalogueMealGroups
  return catalogueMealGroups.map((group) => {
    const imported = plan.meals.find((meal) => meal.id === group.id)
    if (!imported || imported.items.length === 0) return group
    const description = imported.items.join(' • ')
    const hasArabicTitle = /[\u0600-\u06FF]/.test(imported.title)
    const config = sectionConfig.find((item) => item.id === group.id)!
    return {
      ...group,
      options: [{
        id: `imported-${group.id}`,
        name: hasArabicTitle ? imported.title : config.titleAr,
        nameEn: imported.title,
        description,
        descriptionEn: description,
        calories: imported.calories,
        protein: imported.protein,
        carbs: imported.carbs,
        fat: imported.fat,
        color: group.options[0].color,
        glyph: group.options[0].glyph,
        imageUrl: `${import.meta.env.BASE_URL}meal-images/${group.id}.svg`,
        isImported: true,
      }, ...group.options],
    }
  })
}
