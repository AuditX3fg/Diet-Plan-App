import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import type { AppTheme } from '../theme'
import type { AppData, MoreSection, UserAccount } from '../types'
import { ScreenScroll, SectionHeader } from '../components/ui'
import { tr } from '../i18n'
import { AdminPanel } from './AdminPanel'
import { HabitsPanel } from './more/HabitsPanel'
import { ScannerPanel } from './more/ScannerPanel'
import { SettingsPanel } from './more/SettingsPanel'
import { WorkoutsPanel } from './more/WorkoutsPanel'

const sections: Array<{ id: MoreSection; glyph: string; en: string; ar: string }> = [
  { id: 'habits', glyph: '✓', en: 'Habits', ar: 'العادات' },
  { id: 'workouts', glyph: '↟', en: 'Workout', ar: 'التمرين' },
  { id: 'scanner', glyph: '⌗', en: 'Scanner', ar: 'الماسح' },
  { id: 'settings', glyph: '⚙', en: 'Settings', ar: 'الإعدادات' },
  { id: 'admin', glyph: '⌾', en: 'Admin', ar: 'الإدارة' },
]

interface MoreScreenProps {
  account: UserAccount
  data: AppData
  theme: AppTheme
  onChangeAccount: (next: UserAccount) => void
  onChangeData: (next: AppData) => void
  onReplacePlan: () => void
  onLogout: () => void
}

export function MoreScreen({ account, data, theme, onChangeAccount, onChangeData, onReplacePlan, onLogout }: MoreScreenProps) {
  const [section, setSection] = useState<MoreSection>('habits')
  const visibleSections = account.isSuperAdmin ? sections : sections.filter((item) => item.id !== 'admin')

  return (
    <ScreenScroll theme={theme}>
      <SectionHeader
        eyebrow={tr(data.language, 'MORE TOOLS', 'أدوات إضافية')}
        title={tr(data.language, 'Your wellness hub', 'مركز صحتك')}
        caption={tr(data.language, 'Habits, workouts, food scan, and app preferences.', 'العادات والتمرين ومسح الطعام وإعدادات التطبيق.')}
        theme={theme}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>
        {visibleSections.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setSection(item.id)}
            style={[
              styles.sectionTab,
              {
                backgroundColor: section === item.id ? theme.primary : theme.surface,
                borderColor: section === item.id ? theme.primary : theme.line,
              },
            ]}
          >
            <Text style={[styles.sectionGlyph, { color: section === item.id ? '#fff' : theme.primary }]}>{item.glyph}</Text>
            <Text style={[styles.sectionLabel, { color: section === item.id ? '#fff' : theme.text }]}>
              {data.language === 'ar' ? item.ar : item.en}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {section === 'habits' ? <HabitsPanel data={data} theme={theme} onChangeData={onChangeData} /> : null}
      {section === 'workouts' ? <WorkoutsPanel account={account} data={data} theme={theme} onChangeAccount={onChangeAccount} onChangeData={onChangeData} /> : null}
      {section === 'scanner' ? <ScannerPanel data={data} theme={theme} onChangeData={onChangeData} /> : null}
      {section === 'settings' ? <SettingsPanel account={account} data={data} theme={theme} onChangeAccount={onChangeAccount} onChangeData={onChangeData} onReplacePlan={onReplacePlan} onLogout={onLogout} /> : null}
      {section === 'admin' && account.isSuperAdmin ? <AdminPanel language={data.language} theme={theme} /> : null}
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  sectionTabs: { gap: 8 },
  sectionTab: { minWidth: 96, minHeight: 66, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  sectionGlyph: { fontSize: 18, fontWeight: '900' },
  sectionLabel: { fontSize: 10, fontWeight: '900' },
})
