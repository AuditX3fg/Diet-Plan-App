import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as Haptics from 'expo-haptics'
import type { AppTheme } from '../theme'
import type { ImportedDietPlan, UserAccount } from '../types'
import { parseDietPlanPdf } from '../services/pdf'
import { Card, FormField, PrimaryButton, ScreenScroll, SecondaryButton, SectionHeader } from '../components/ui'
import { BrandMark } from '../components/BrandMark'
import { palette } from '../theme'

export function PdfImportScreen({ account, theme, existingPlan, onComplete, onSkip, onCancel }: {
  account: UserAccount
  theme: AppTheme
  existingPlan?: ImportedDietPlan
  onComplete: (plan: ImportedDietPlan) => void
  onSkip?: () => void
  onCancel?: () => void
}) {
  const [plan, setPlan] = useState<ImportedDietPlan | null>(existingPlan ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function choosePdf() {
    setError('')
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false })
    if (result.canceled) return
    setBusy(true)
    try {
      const parsed = await parseDietPlanPdf(result.assets[0])
      setPlan(parsed)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The PDF could not be read.')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setBusy(false)
    }
  }

  function updateMetric(key: 'dailyCalories' | 'protein' | 'carbs' | 'fat', value: string) {
    if (!plan) return
    setPlan({ ...plan, [key]: Math.max(0, Number(value) || 0) })
  }

  function updateMeal(index: number, value: string) {
    if (!plan) return
    const meals = [...plan.meals]
    meals[index] = { ...meals[index], items: value.split(/[,\n•]+/).map((item) => item.trim()).filter(Boolean) }
    setPlan({ ...plan, meals })
  }

  return (
    <ScreenScroll theme={theme} contentStyle={styles.content}>
      <View style={styles.topRow}><BrandMark size={50} />{onCancel ? <SecondaryButton label="Close" onPress={onCancel} compact theme={theme} /> : null}</View>
      <SectionHeader eyebrow="PERSONALIZE YOUR ACCOUNT" title="Upload your diet plan" caption={`Hi ${account.displayName.split(' ')[0]}. Choose the PDF from your dietitian and confirm what Tawazon detects.`} theme={theme} />

      {!plan ? (
        <>
          <Pressable onPress={choosePdf} disabled={busy} style={({ pressed }) => [styles.dropzone, { borderColor: theme.primary, backgroundColor: theme.primarySoft, opacity: pressed ? 0.78 : 1 }]}>
            {busy ? <ActivityIndicator size="large" color={theme.primary} /> : <View style={[styles.uploadIcon, { backgroundColor: theme.surface }]}><Text style={styles.uploadGlyph}>⇧</Text></View>}
            <Text style={[styles.dropTitle, { color: theme.text }]}>{busy ? 'Reading your plan…' : 'Choose diet-plan PDF'}</Text>
            <Text style={[styles.dropBody, { color: theme.muted }]}>{busy ? 'Extracting text, meals, and requirements on this device.' : 'PDF only · maximum 10 MB'}</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Card theme={theme} style={styles.privacyCard}><Text style={styles.privacyGlyph}>⌾</Text><View style={styles.flex}><Text style={[styles.privacyTitle, { color: theme.text }]}>Processed on this device</Text><Text style={[styles.privacyBody, { color: theme.muted }]}>The selected file stays local. Only the reviewed meal and nutrition data is saved to this account.</Text></View></Card>
          {onSkip ? <SecondaryButton label="Use standard catalogue for now" onPress={onSkip} theme={theme} /> : null}
        </>
      ) : (
        <>
          <Card theme={theme} style={styles.fileCard}><View style={styles.fileIcon}><Text style={styles.fileGlyph}>PDF</Text></View><View style={styles.flex}><Text numberOfLines={1} style={[styles.fileName, { color: theme.text }]}>{plan.fileName}</Text><Text style={[styles.fileMeta, { color: theme.muted }]}>{plan.pageCount} {plan.pageCount === 1 ? 'page' : 'pages'} · {plan.extractedCharacters} characters extracted</Text></View><SecondaryButton label="Change" onPress={() => setPlan(null)} compact theme={theme} /></Card>
          {plan.warning ? <View style={styles.warning}><Text style={styles.warningGlyph}>!</Text><Text style={styles.warningText}>{plan.warning}</Text></View> : null}

          <SectionHeader eyebrow="DETECTED REQUIREMENTS" title="Confirm your targets" caption="Every value is editable before it is saved." theme={theme} />
          <View style={styles.metricGrid}>
            <View style={styles.metricField}><FormField label="Calories (kcal)" value={String(plan.dailyCalories)} onChangeText={(value) => updateMetric('dailyCalories', value)} keyboardType="number-pad" theme={theme} /></View>
            <View style={styles.metricField}><FormField label="Protein (g)" value={String(plan.protein)} onChangeText={(value) => updateMetric('protein', value)} keyboardType="number-pad" theme={theme} /></View>
            <View style={styles.metricField}><FormField label="Carbs (g)" value={String(plan.carbs)} onChangeText={(value) => updateMetric('carbs', value)} keyboardType="number-pad" theme={theme} /></View>
            <View style={styles.metricField}><FormField label="Fat (g)" value={String(plan.fat)} onChangeText={(value) => updateMetric('fat', value)} keyboardType="number-pad" theme={theme} /></View>
          </View>

          <SectionHeader eyebrow="MEAL STRUCTURE" title="Meals found in the PDF" caption="Review the ingredients for each meal." theme={theme} />
          {plan.meals.map((meal, index) => <Card key={meal.id} theme={theme} style={styles.mealReview}><View style={[styles.mealBadge, { backgroundColor: meal.id === 'breakfast' ? palette.amberSoft : meal.id === 'snack' ? palette.lilacSoft : meal.id === 'lunch' ? palette.coralSoft : palette.green100 }]}><Text style={styles.mealGlyph}>{meal.id === 'breakfast' ? '🍳' : meal.id === 'snack' ? '🥣' : meal.id === 'lunch' ? '🍗' : '🍽️'}</Text></View><View style={styles.flex}><Text style={[styles.mealName, { color: theme.text }]}>{meal.title}</Text><FormField label="Ingredients / instructions" value={meal.items.join(', ')} onChangeText={(value) => updateMeal(index, value)} placeholder="Enter this meal from your plan" multiline theme={theme} /></View><Text style={[styles.mealCalories, { color: theme.primary }]}>{meal.calories} kcal</Text></Card>)}

          {plan.notes.length ? <Card theme={theme} style={styles.notesCard}><Text style={styles.notesTitle}>NOTES DETECTED</Text>{plan.notes.map((note, index) => <Text key={`${note}-${index}`} style={[styles.note, { color: theme.text }]}>• {note}</Text>)}</Card> : null}
          <PrimaryButton label="Load this plan into my account" icon="→" onPress={() => onComplete(plan)} theme={theme} />
        </>
      )}
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 44 },
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropzone: { minHeight: 228, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 26, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10 },
  uploadIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  uploadGlyph: { color: palette.green700, fontSize: 30, fontWeight: '900' },
  dropTitle: { marginTop: 3, fontSize: 18, fontWeight: '900' },
  dropBody: { fontSize: 12, textAlign: 'center' },
  error: { color: palette.danger, fontSize: 12, fontWeight: '700' },
  privacyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  privacyGlyph: { color: palette.green700, fontSize: 22 },
  privacyTitle: { fontSize: 14, fontWeight: '900' },
  privacyBody: { marginTop: 3, fontSize: 12, lineHeight: 18 },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: palette.green100, alignItems: 'center', justifyContent: 'center' },
  fileGlyph: { color: palette.green800, fontSize: 11, fontWeight: '900' },
  fileName: { fontSize: 14, fontWeight: '900' },
  fileMeta: { marginTop: 3, fontSize: 10 },
  warning: { padding: 14, borderRadius: 16, backgroundColor: '#fff1d6', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  warningGlyph: { width: 22, height: 22, borderRadius: 11, textAlign: 'center', color: '#8b5b12', fontWeight: '900', backgroundColor: '#f8d898' },
  warningText: { flex: 1, color: '#76501a', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricField: { width: '48%' },
  mealReview: { gap: 13 },
  mealBadge: { width: 47, height: 47, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mealGlyph: { fontSize: 23 },
  mealName: { marginTop: -47, marginLeft: 60, marginBottom: 20, minHeight: 27, fontSize: 15, fontWeight: '900' },
  mealCalories: { position: 'absolute', right: 18, top: 20, fontSize: 11, fontWeight: '900' },
  notesCard: { gap: 8, backgroundColor: '#fff8e8', borderColor: '#f2dfb8' },
  notesTitle: { color: '#8a651f', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  note: { fontSize: 12, lineHeight: 18 },
})
