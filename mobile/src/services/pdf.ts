import type { DocumentPickerAsset } from 'expo-document-picker'
import { File } from 'expo-file-system'
import { inflate } from 'pako'
import type { DietMealId, ImportedDietMeal, ImportedDietPlan } from '../types'

const sectionConfig: Array<{ id: DietMealId; title: string; share: number; pattern: RegExp; hints: RegExp }> = [
  { id: 'breakfast', title: 'Breakfast from PDF', share: 0.25, pattern: /^(?:breakfast|meal\s*1|الفطور|فطور|الوجبة\s*الأولى|وجبة\s*1)\s*[:\-–—]?\s*(.*)$/i, hints: /egg|oat|pancake|toast|labneh|cheese|بيض|شوفان|توست|لبنة|جبن/i },
  { id: 'snack', title: 'Snack from PDF', share: 0.15, pattern: /^(?:snack|meal\s*2|وجبة\s*خفيفة|سناك|الوجبة\s*الثانية|وجبة\s*2)\s*[:\-–—]?\s*(.*)$/i, hints: /snack|fruit|yogurt|bar|nuts|فاكهة|فواكه|زبادي|مكسرات|سناك/i },
  { id: 'lunch', title: 'Lunch from PDF', share: 0.35, pattern: /^(?:lunch|meal\s*3|الغداء|غداء|الوجبة\s*الثالثة|وجبة\s*3)\s*[:\-–—]?\s*(.*)$/i, hints: /chicken|beef|meat|rice|pasta|دجاج|لحمة|لحم|رز|أرز|معكرونة/i },
  { id: 'dinner', title: 'Dinner from PDF', share: 0.25, pattern: /^(?:dinner|meal\s*4|العشاء|عشاء|الوجبة\s*الرابعة|وجبة\s*4)\s*[:\-–—]?\s*(.*)$/i, hints: /fish|tuna|salad|soup|shrimp|سمك|تونا|سلطة|شوربة|قريدس/i },
]

const MAX_STREAMS = 500
const MAX_STREAM_BYTES = 2 * 1024 * 1024
const MAX_EXTRACTED_CHARACTERS = 250_000
const MAX_TEXT_BLOCKS_PER_STREAM = 2_000
const MAX_LITERAL_CHARACTERS = 8_192
const urlPattern = /https?:\/\/[^\s<>{}\[\]"']+/gi

function safeExternalUrl(value: unknown) {
  const candidate = String(value ?? '').trim().replace(/&amp;/gi, '&').replace(/[),.;:!?]+$/, '')
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined
  } catch {
    return undefined
  }
}

function linksIn(value: string) {
  return [...value.matchAll(urlPattern)].map((match) => safeExternalUrl(match[0])).filter((url): url is string => Boolean(url))
}

function bytesToBinary(bytes: Uint8Array) {
  let output = ''
  for (let index = 0; index < bytes.length; index += 8192) {
    output += String.fromCharCode(...bytes.subarray(index, Math.min(index + 8192, bytes.length)))
  }
  return output
}

function decodePdfLiteral(raw: string) {
  let value = ''
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (char !== '\\') {
      value += char
      continue
    }
    const next = raw[++index]
    if (next === undefined) break
    if (next === 'n') value += '\n'
    else if (next === 'r') value += '\r'
    else if (next === 't') value += '\t'
    else if (next === 'b') value += '\b'
    else if (next === 'f') value += '\f'
    else if (/[0-7]/.test(next)) {
      let octal = next
      for (let count = 0; count < 2 && /[0-7]/.test(raw[index + 1] ?? ''); count += 1) octal += raw[++index]
      value += String.fromCharCode(parseInt(octal, 8))
    } else if (next !== '\n' && next !== '\r') value += next
  }
  return value
}

function literalStrings(block: string) {
  const values: string[] = []
  for (let index = 0; index < block.length; index += 1) {
    if (block[index] !== '(') continue
    let depth = 1
    let raw = ''
    index += 1
    for (; index < block.length && depth > 0; index += 1) {
      const char = block[index]
      if (char === '\\') {
        if (raw.length < MAX_LITERAL_CHARACTERS) raw += char + (block[index + 1] ?? '')
        index += 1
      } else if (char === '(') {
        depth += 1
        raw += char
      } else if (char === ')') {
        depth -= 1
        if (depth > 0) raw += char
      } else if (raw.length < MAX_LITERAL_CHARACTERS) raw += char
    }
    const decoded = decodePdfLiteral(raw).trim()
    if (decoded) values.push(decoded)
  }
  return values
}

function decodeHexText(hex: string) {
  const pairs: number[] = []
  let highNibble = -1
  for (let index = 0; index < hex.length && pairs.length < MAX_LITERAL_CHARACTERS; index += 1) {
    const code = hex.charCodeAt(index)
    const nibble = code >= 48 && code <= 57 ? code - 48 : code >= 65 && code <= 70 ? code - 55 : code >= 97 && code <= 102 ? code - 87 : -1
    if (nibble < 0) continue
    if (highNibble < 0) highNibble = nibble
    else {
      pairs.push(highNibble * 16 + nibble)
      highNibble = -1
    }
  }
  const bytes = Uint8Array.from(pairs)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let result = ''
    for (let index = 2; index + 1 < bytes.length; index += 2) result += String.fromCharCode(bytes[index] * 256 + bytes[index + 1])
    return result
  }
  return bytesToBinary(bytes)
}

function hexStrings(block: string) {
  const values: string[] = []
  for (let index = 0; index < block.length; index += 1) {
    if (block[index] !== '<' || block[index - 1] === '<') continue
    const end = block.indexOf('>', index + 1)
    if (end < 0) break
    if (block[end + 1] === '>' || end - index > MAX_LITERAL_CHARACTERS * 2 + 1) {
      index = end
      continue
    }
    let valid = true
    for (let cursor = index + 1; cursor < end; cursor += 1) {
      const code = block.charCodeAt(cursor)
      const hex = (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102)
      const whitespace = code === 9 || code === 10 || code === 12 || code === 13 || code === 32
      if (!hex && !whitespace) {
        valid = false
        break
      }
    }
    if (valid) {
      const decoded = decodeHexText(block.slice(index + 1, end)).trim()
      if (decoded) values.push(decoded)
    }
    index = end
  }
  return values
}

function textFromContentStream(stream: string) {
  const values: string[] = []
  let cursor = 0
  let blockCount = 0
  let collectedCharacters = 0
  while (cursor < stream.length && blockCount < MAX_TEXT_BLOCKS_PER_STREAM && collectedCharacters < MAX_EXTRACTED_CHARACTERS) {
    const blockStart = stream.indexOf('BT', cursor)
    if (blockStart < 0) break
    const blockEnd = stream.indexOf('ET', blockStart + 2)
    if (blockEnd < 0) break
    const block = stream.slice(blockStart + 2, Math.min(blockEnd, blockStart + 2 + MAX_STREAM_BYTES))
    for (const value of [...literalStrings(block), ...hexStrings(block)]) {
      if (collectedCharacters >= MAX_EXTRACTED_CHARACTERS) break
      const available = MAX_EXTRACTED_CHARACTERS - collectedCharacters
      const bounded = value.slice(0, available)
      values.push(bounded)
      collectedCharacters += bounded.length + 1
    }
    cursor = blockEnd + 2
    blockCount += 1
  }
  return values.join('\n').slice(0, MAX_EXTRACTED_CHARACTERS)
}

function countPdfPages(binary: string) {
  let count = 0
  let cursor = 0
  while (cursor < binary.length) {
    const typeIndex = binary.indexOf('/Type', cursor)
    if (typeIndex < 0) break
    let valueIndex = typeIndex + 5
    while (valueIndex < binary.length && binary.charCodeAt(valueIndex) <= 32) valueIndex += 1
    if (binary.startsWith('/Page', valueIndex) && binary[valueIndex + 5] !== 's') count += 1
    cursor = typeIndex + 5
  }
  return Math.max(1, count)
}

function sanitizeExtractedText(value: string) {
  let result = ''
  for (let index = 0; index < value.length && result.length < MAX_EXTRACTED_CHARACTERS; index += 1) {
    const code = value.charCodeAt(index)
    result += (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)) ? ' ' : value[index]
  }
  return result
}

function extractPdfText(bytes: Uint8Array) {
  const binary = bytesToBinary(bytes)
  const links: string[] = []
  let linkCursor = 0
  while (linkCursor < binary.length && links.length < 100) {
    const marker = binary.indexOf('/URI', linkCursor)
    if (marker < 0) break
    const nearby = binary.slice(marker + 4, Math.min(binary.length, marker + 4 + MAX_LITERAL_CHARACTERS * 2 + 32))
    const candidate = literalStrings(nearby)[0] ?? hexStrings(nearby)[0]
    const link = safeExternalUrl(candidate)
    if (link && !links.includes(link)) links.push(link)
    linkCursor = marker + 4
  }
  const streams: string[] = []
  let cursor = 0
  let streamCount = 0
  let extractedCharacters = 0
  while (cursor < binary.length && streamCount < MAX_STREAMS && extractedCharacters < MAX_EXTRACTED_CHARACTERS) {
    const marker = binary.indexOf('stream', cursor)
    if (marker < 0) break
    let streamStart = marker + 6
    if (binary[streamStart] === '\r') streamStart += 1
    if (binary[streamStart] !== '\n') {
      cursor = marker + 6
      continue
    }
    streamStart += 1
    const streamEnd = binary.indexOf('endstream', streamStart)
    if (streamEnd < 0) break
    const dictionaryStart = binary.lastIndexOf('<<', marker)
    const dictionary = dictionaryStart >= 0 ? binary.slice(dictionaryStart, marker) : ''
    const streamBytes = bytes.subarray(streamStart, streamEnd)
    try {
      const decodedBytes = dictionary.includes('/FlateDecode') ? inflate(streamBytes) : streamBytes
      const content = bytesToBinary(decodedBytes.subarray(0, MAX_STREAM_BYTES))
      const extracted = textFromContentStream(content)
      if (extracted) {
        const available = MAX_EXTRACTED_CHARACTERS - extractedCharacters
        streams.push(extracted.slice(0, available))
        extractedCharacters += Math.min(extracted.length, available)
      }
    } catch {
      const extracted = textFromContentStream(bytesToBinary(streamBytes.subarray(0, MAX_STREAM_BYTES)))
      if (extracted) {
        const available = MAX_EXTRACTED_CHARACTERS - extractedCharacters
        streams.push(extracted.slice(0, available))
        extractedCharacters += Math.min(extracted.length, available)
      }
    }
    cursor = streamEnd + 9
    streamCount += 1
  }
  return {
    text: sanitizeExtractedText(streams.join('\n')),
    pageCount: countPdfPages(binary),
    links,
  }
}

function tidyLine(line: string) {
  return line.replace(/^[\s•·▪◦*–—-]+/, '').replace(/\s+/g, ' ').trim()
}

function withoutLinks(value: string) {
  return tidyLine(value.replace(urlPattern, '').replace(/^(?:watch|video|meal\s+video|شاهد|فيديو)(?:\s+(?:video|الفيديو))?\s*[:\-–—]?\s*$/i, ''))
}

function splitIntoLines(text: string) {
  return text.split('\n').map((line) => tidyLine(line.slice(0, 1_000))).filter((line) => line.length > 1)
}

function numbersIn(value: string) {
  const numbers: number[] = []
  let token = ''
  for (let index = 0; index <= value.length; index += 1) {
    const character = value[index] ?? ' '
    if ((character >= '0' && character <= '9') || (character === '.' && token && !token.includes('.'))) token += character
    else if (token) {
      const parsed = Number(token)
      if (Number.isFinite(parsed)) numbers.push(parsed)
      token = ''
    }
  }
  return numbers
}

function metricNearLabel(text: string, labels: string[], min: number, max: number) {
  const lower = text.toLowerCase()
  for (const label of labels) {
    let cursor = 0
    while (cursor < lower.length) {
      const index = lower.indexOf(label.toLowerCase(), cursor)
      if (index < 0) break
      const nearby = numbersIn(text.slice(Math.max(0, index - 24), Math.min(text.length, index + label.length + 24)))
      const value = nearby.find((candidate) => candidate >= min && candidate <= max)
      if (value !== undefined) return Math.round(value)
      cursor = index + label.length
    }
  }
  return undefined
}

function caloriesIn(lines: string[]) {
  return lines.reduce((sum, line) => sum + Number(line.match(/([0-9]{2,4})\s*(?:kcal|calories?|سعرة|سعرات|كالوري)/i)?.[1] ?? 0), 0)
}

function macroIn(lines: string[], label: string) {
  return lines.reduce((sum, line) => sum + Number(line.match(new RegExp(`([0-9]{1,3}(?:\\.[0-9]+)?)\\s*(?:g|grams?|غم|غ)\\s*(?:${label})`, 'i'))?.[1] ?? 0), 0)
}

function extractMeals(lines: string[], daily: { calories: number; protein: number; carbs: number; fat: number }, documentLinks: string[] = []): ImportedDietMeal[] {
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
    if (current && !/^(?:daily|total|target|requirements?|calories?|protein|carbs?|fat|السعرات|البروتين|الكربوهيدرات|الدهون)/i.test(line)) collected[current].push(line)
  })

  if (Object.values(collected).every((items) => items.length === 0)) {
    lines.filter((line) => line.length >= 4 && line.length <= 180).forEach((line) => {
      const inferred = sectionConfig.find((config) => config.hints.test(line))
      if (inferred && collected[inferred.id].length < 6) collected[inferred.id].push(line)
    })
  }

  const meals = sectionConfig.map((config): ImportedDietMeal => {
    const sectionLines = collected[config.id].map(tidyLine).filter(Boolean)
    const videoUrl = sectionLines.flatMap(linksIn)[0]
    const items = [...new Set(sectionLines.map(withoutLinks).filter(Boolean))].slice(0, 10)
    return {
      id: config.id,
      title: config.title,
      items,
      calories: Math.round(caloriesIn(items) || daily.calories * config.share),
      protein: Math.round(macroIn(items, 'protein|بروتين') || daily.protein * config.share),
      carbs: Math.round(macroIn(items, 'carbs?|carbohydrates?|كربوهيدرات|كارب') || daily.carbs * config.share),
      fat: Math.round(macroIn(items, 'fat|دهون') || daily.fat * config.share),
      videoUrl,
    }
  })
  const assigned = new Set(meals.map((meal) => meal.videoUrl).filter(Boolean))
  const remaining = [...new Set(documentLinks.map(safeExternalUrl).filter((url): url is string => Boolean(url) && !assigned.has(url)))]
  meals.forEach((meal) => {
    if (!meal.videoUrl && remaining.length) meal.videoUrl = remaining.shift()
  })
  return meals
}

export async function parseDietPlanPdf(asset: DocumentPickerAsset): Promise<ImportedDietPlan> {
  if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('The PDF must be smaller than 10 MB.')
  if (asset.mimeType && asset.mimeType !== 'application/pdf' && !asset.name.toLowerCase().endsWith('.pdf')) throw new Error('Choose a PDF file.')
  const bytes = await new File(asset.uri).bytes()
  let extracted: { text: string; pageCount: number; links: string[] }
  let parserWarning: string | undefined
  try {
    extracted = extractPdfText(bytes)
  } catch {
    extracted = { text: '', pageCount: 1, links: [] }
    parserWarning = 'This PDF uses a structure the automatic reader could not decode. Enter the targets and meals manually before loading it.'
  }
  const text = extracted.text
  const dailyCalories = metricNearLabel(text, ['daily calories', 'calorie target', 'kcal', 'السعرات اليومية', 'السعرات', 'سعرات يومية'], 800, 6000) ?? 1900
  const protein = metricNearLabel(text, ['protein', 'بروتين'], 20, 500) ?? 150
  const fat = metricNearLabel(text, ['fat', 'دهون'], 15, 300) ?? 65
  const fallbackCarbs = Math.max(40, Math.round((dailyCalories - protein * 4 - fat * 9) / 4))
  const carbs = metricNearLabel(text, ['carbs', 'carbohydrates', 'كربوهيدرات', 'كارب'], 20, 800) ?? fallbackCarbs
  const daily = { calories: dailyCalories, protein, carbs, fat }
  const lines = splitIntoLines(text)
  let readableCharacters = 0
  for (let index = 0; index < text.length && readableCharacters < 25; index += 1) {
    if (text.charCodeAt(index) > 32) readableCharacters += 1
  }
  const readable = readableCharacters >= 25
  return {
    fileName: asset.name,
    uploadedAt: new Date().toISOString(),
    pageCount: extracted.pageCount,
    extractedCharacters: text.length,
    dailyCalories,
    protein,
    carbs,
    fat,
    meals: extractMeals(lines, daily, extracted.links),
    notes: lines.filter((line) => /note|avoid|allerg|instruction|ملاحظة|تجنب|حساسية|تعليمات/i.test(line)).slice(0, 6),
    warning: parserWarning ?? (readable ? undefined : 'This PDF may be scanned or use embedded fonts. Confirm the targets and meal text manually before loading it.'),
  }
}
