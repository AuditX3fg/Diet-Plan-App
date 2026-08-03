import type { ReactNode } from 'react'
import { ActivityIndicator, KeyboardTypeOptions, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { AppTheme } from '../theme'
import { palette } from '../theme'

export function ScreenScroll({ children, theme, contentStyle }: { children: ReactNode; theme: AppTheme; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scrollContent, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
    </SafeAreaView>
  )
}

export function Card({ children, theme, style }: { children: ReactNode; theme: AppTheme; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }, style]}>{children}</View>
}

export function PrimaryButton({ label, onPress, theme, busy, disabled, icon }: { label: string; onPress: () => void; theme: AppTheme; busy?: boolean; disabled?: boolean; icon?: string }) {
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} style={({ pressed }) => [styles.primaryButton, { backgroundColor: disabled ? theme.line : theme.primary, opacity: pressed ? 0.84 : 1 }]}>
      {busy ? <ActivityIndicator color="#fff" /> : <><Text style={styles.primaryButtonLabel}>{label}</Text>{icon ? <Text style={styles.primaryButtonIcon}>{icon}</Text> : null}</>}
    </Pressable>
  )
}

export function SecondaryButton({ label, onPress, theme, danger, compact, disabled }: { label: string; onPress: () => void; theme: AppTheme; danger?: boolean; compact?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.secondaryButton, compact && styles.compactButton, { borderColor: danger ? palette.danger : theme.line, backgroundColor: theme.surfaceAlt, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }]}>
      <Text style={[styles.secondaryButtonLabel, { color: danger ? palette.danger : theme.text }]}>{label}</Text>
    </Pressable>
  )
}

export function FormField({ label, theme, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize = 'none', multiline, maxLength, editable = true, rightToLeft, ...props }: {
  label: string
  theme: AppTheme
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: TextInputProps['autoCapitalize']
  multiline?: boolean
  maxLength?: number
  editable?: boolean
  rightToLeft?: boolean
} & Omit<TextInputProps, 'value' | 'onChangeText'>) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.muted, textAlign: rightToLeft ? 'right' : 'left' }]}>{label}</Text>
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        style={[styles.field, multiline && styles.multilineField, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.line, textAlign: rightToLeft ? 'right' : 'left' }]}
      />
    </View>
  )
}

export function SectionHeader({ eyebrow, title, caption, theme, action }: { eyebrow?: string; title: string; caption?: string; theme: AppTheme; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>{eyebrow ? <Text style={[styles.eyebrow, { color: theme.primary }]}>{eyebrow}</Text> : null}<Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>{caption ? <Text style={[styles.caption, { color: theme.muted }]}>{caption}</Text> : null}</View>
      {action}
    </View>
  )
}

export function ProgressBar({ value, theme, color, height = 8 }: { value: number; theme: AppTheme; color?: string; height?: number }) {
  const width = `${Math.max(0, Math.min(100, value))}%` as `${number}%`
  return <View style={[styles.progressTrack, { height, backgroundColor: theme.line }]}><View style={[styles.progressFill, { width, backgroundColor: color ?? theme.primary }]} /></View>
}

export function MetricChip({ label, value, theme, tint }: { label: string; value: string; theme: AppTheme; tint?: string }) {
  return <View style={[styles.metricChip, { backgroundColor: tint ?? theme.surfaceAlt }]}><Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text><Text style={[styles.metricLabel, { color: theme.muted }]}>{label}</Text></View>
}

export function EmptyState({ glyph, title, body, theme }: { glyph: string; title: string; body: string; theme: AppTheme }) {
  return <View style={styles.emptyState}><Text style={styles.emptyGlyph}>{glyph}</Text><Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.emptyBody, { color: theme.muted }]}>{body}</Text></View>
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 126, gap: 18 },
  card: { borderWidth: 1, borderRadius: 22, padding: 18, shadowColor: '#10291f', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  primaryButton: { minHeight: 54, borderRadius: 17, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#1d4d3f', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  primaryButtonLabel: { color: '#fff', fontSize: 15, fontWeight: '800' },
  primaryButtonIcon: { color: '#fff', fontSize: 18 },
  secondaryButton: { minHeight: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  compactButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 12 },
  secondaryButtonLabel: { fontSize: 13, fontWeight: '800' },
  fieldWrap: { gap: 7 },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  field: { minHeight: 51, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontSize: 15 },
  multilineField: { minHeight: 86, paddingTop: 13, textAlignVertical: 'top' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 },
  sectionHeaderCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.15, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.5 },
  caption: { fontSize: 13, lineHeight: 19 },
  progressTrack: { width: '100%', overflow: 'hidden', borderRadius: 999 },
  progressFill: { height: '100%', borderRadius: 999 },
  metricChip: { flex: 1, minWidth: 74, paddingVertical: 13, paddingHorizontal: 10, borderRadius: 15, alignItems: 'center', gap: 3 },
  metricValue: { fontSize: 17, fontWeight: '900' },
  metricLabel: { fontSize: 10, fontWeight: '700' },
  emptyState: { paddingVertical: 28, paddingHorizontal: 18, alignItems: 'center', gap: 8 },
  emptyGlyph: { fontSize: 34 },
  emptyTitle: { fontSize: 17, fontWeight: '900' },
  emptyBody: { maxWidth: 280, textAlign: 'center', fontSize: 13, lineHeight: 19 },
})
