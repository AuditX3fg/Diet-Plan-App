import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { AppTheme } from '../../theme'
import type { AppData } from '../../types'
import { habitTasks } from '../../data'
import { Card, SectionHeader } from '../../components/ui'
import { completedHabitCount } from '../../utils/nutrition'
import { tr } from '../../i18n'

interface HabitsPanelProps {
  data: AppData
  theme: AppTheme
  onChangeData: (next: AppData) => void
}

export function HabitsPanel({ data, theme, onChangeData }: HabitsPanelProps) {
  const today = new Date().toISOString().slice(0, 10)
  const completed = completedHabitCount(data, today)

  function toggle(id: typeof habitTasks[number]['id']) {
    const todayHabits = data.habits[today] ?? {}
    onChangeData({
      ...data,
      habits: {
        ...data.habits,
        [today]: { ...todayHabits, [id]: !todayHabits[id] },
      },
    })
    void Haptics.selectionAsync()
  }

  return (
    <View style={styles.panel}>
      <SectionHeader
        eyebrow={tr(data.language, 'DAILY CHECK-IN', 'المتابعة اليومية')}
        title={tr(data.language, `${completed} of 6 complete`, `${completed} من ٦ مكتملة`)}
        caption={tr(data.language, 'Complete all six to extend your adherence streak.', 'أكمل الستة لزيادة سلسلة الالتزام.')}
        theme={theme}
      />
      <Card theme={theme} style={styles.habitProgress}>
        <View style={[styles.habitRing, { borderColor: completed === 6 ? theme.primary : theme.line }]}>
          <Text style={[styles.habitRingValue, { color: theme.text }]}>{completed}</Text>
          <Text style={[styles.habitRingUnit, { color: theme.muted }]}>/ 6</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.habitProgressTitle, { color: theme.text }]}>
            {completed === 6 ? tr(data.language, 'Perfect day!', 'يوم مثالي!') : tr(data.language, 'Keep the rhythm going', 'استمر على هذا الإيقاع')}
          </Text>
          <Text style={[styles.habitProgressBody, { color: theme.muted }]}>
            {tr(data.language, 'Each check-in keeps your plan visible and intentional.', 'كل متابعة تبقي خطتك واضحة ومقصودة.')}
          </Text>
        </View>
      </Card>
      <View style={styles.habitList}>
        {habitTasks.map((task) => {
          const checked = Boolean(data.habits[today]?.[task.id])
          return (
            <Pressable key={task.id} onPress={() => toggle(task.id)}>
              <Card theme={theme} style={[styles.habitItem, checked && { borderColor: theme.primary, backgroundColor: theme.primarySoft }]}>
                <Text style={styles.habitGlyph}>{task.glyph}</Text>
                <Text style={[styles.habitText, { color: theme.text }]}>{data.language === 'ar' ? task.label : task.labelEn}</Text>
                <View style={[styles.check, { backgroundColor: checked ? theme.primary : theme.surfaceAlt, borderColor: checked ? theme.primary : theme.line }]}>
                  <Text style={styles.checkText}>{checked ? '✓' : ''}</Text>
                </View>
              </Card>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { gap: 17 },
  habitProgress: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  habitRing: { width: 76, height: 76, borderRadius: 38, borderWidth: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  habitRingValue: { fontSize: 22, fontWeight: '900' },
  habitRingUnit: { fontSize: 9, fontWeight: '700' },
  habitProgressTitle: { fontSize: 16, fontWeight: '900' },
  habitProgressBody: { marginTop: 4, fontSize: 11, lineHeight: 17 },
  habitList: { gap: 9 },
  habitItem: { minHeight: 68, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitGlyph: { width: 36, fontSize: 23, textAlign: 'center' },
  habitText: { flex: 1, fontSize: 13, fontWeight: '800' },
  check: { width: 29, height: 29, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#fff', fontSize: 15, fontWeight: '900' },
})
