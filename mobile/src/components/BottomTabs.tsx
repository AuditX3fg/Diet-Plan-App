import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { AppTheme } from '../theme'
import type { Language, MainTab } from '../types'
import { tr } from '../i18n'

const items: Array<{ id: MainTab; icon: string; en: string; ar: string }> = [
  { id: 'today', icon: '⌂', en: 'Today', ar: 'اليوم' },
  { id: 'plan', icon: '≡', en: 'Plan', ar: 'الخطة' },
  { id: 'progress', icon: '↗', en: 'Progress', ar: 'التقدم' },
  { id: 'profile', icon: '◯', en: 'Profile', ar: 'الملف' },
  { id: 'more', icon: '•••', en: 'More', ar: 'المزيد' },
]

export function BottomTabs({ active, onChange, theme, language }: { active: MainTab; onChange: (tab: MainTab) => void; theme: AppTheme; language: Language }) {
  return (
    <View style={[styles.shell, { backgroundColor: theme.tabBar, borderColor: theme.line }]}>
      {items.map((item) => {
        const selected = item.id === active
        return <Pressable key={item.id} onPress={() => onChange(item.id)} style={styles.tab}><View style={[styles.iconWrap, selected && { backgroundColor: theme.primarySoft }]}><Text style={[styles.icon, { color: selected ? theme.primary : theme.muted }]}>{item.icon}</Text></View><Text style={[styles.label, { color: selected ? theme.primary : theme.muted }]}>{tr(language, item.en, item.ar)}</Text></Pressable>
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { position: 'absolute', left: 12, right: 12, bottom: 10, minHeight: 72, paddingHorizontal: 6, paddingVertical: 8, flexDirection: 'row', borderWidth: 1, borderRadius: 24, shadowColor: '#10291f', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 9 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconWrap: { minWidth: 34, height: 30, paddingHorizontal: 7, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 18, fontWeight: '900' },
  label: { fontSize: 9, fontWeight: '800' },
})
