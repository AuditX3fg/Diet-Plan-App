import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Card, PrimaryButton, SectionHeader } from '../components/ui'
import type { AppTheme } from '../theme'
import type { Language } from '../types'
import { loadCloudAdminOverview, updateCloudFeedbackStatus, type AdminFeedback, type AdminOverview } from '../services/cloud'
import { tr } from '../i18n'

const eventLabels: Record<string, string> = {
  account_created: 'Created an account', sign_in: 'Signed in', app_open: 'Opened Tawazon', page_view: 'Viewed a page',
  profile_updated: 'Updated profile', feedback_submitted: 'Sent feedback', workout_preference_changed: 'Changed workout plan',
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function AdminPanel({ theme, language }: { theme: AppTheme; language: Language }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState('')

  async function refresh() {
    setLoading(true)
    setError('')
    try { setOverview(await loadCloudAdminOverview()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load admin activity.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [])

  async function changeStatus(item: AdminFeedback, status: AdminFeedback['status']) {
    setUpdatingId(item.id)
    try {
      const response = await updateCloudFeedbackStatus(item.id, status)
      setOverview((current) => current ? { ...current, feedback: current.feedback.map((feedback) => feedback.id === item.id ? { ...feedback, ...response.feedback } : feedback) } : current)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update feedback.') }
    finally { setUpdatingId('') }
  }

  return <View style={styles.panel}>
    <SectionHeader eyebrow={tr(language, 'SUPER ADMIN', 'المشرف العام')} title={tr(language, 'User activity', 'نشاط المستخدمين')} caption={tr(language, 'Secure audit events and feedback. Passwords, recovery codes, health values, and diet-plan files are never shown.', 'أحداث آمنة وملاحظات المستخدمين من دون عرض كلمات المرور أو الرموز أو البيانات الصحية الخاصة.')} theme={theme} />
    <PrimaryButton label={tr(language, 'Refresh activity', 'تحديث النشاط')} onPress={() => void refresh()} busy={loading} theme={theme} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {loading && !overview ? <ActivityIndicator color={theme.primary} /> : null}
    {overview ? <>
      <View style={styles.summaryGrid}>
        {[[overview.summary.totalUsers, 'Total users'], [overview.summary.active24h, 'Active 24h'], [overview.summary.events7d, 'Events 7d'], [overview.summary.newFeedback, 'New feedback']].map(([value, label]) => <Card key={label} theme={theme} style={styles.summaryCard}><Text style={[styles.summaryValue, { color: theme.text }]}>{value}</Text><Text style={[styles.summaryLabel, { color: theme.muted }]}>{label}</Text></Card>)}
      </View>

      <SectionHeader eyebrow="LIVE AUDIT" title={tr(language, 'Recent activity', 'أحدث النشاطات')} theme={theme} />
      <View style={styles.list}>{overview.events.slice(0, 40).map((event) => <Card key={event.id} theme={theme} style={styles.row}><View style={[styles.rowIcon, { backgroundColor: theme.primarySoft }]}><Text style={{ color: theme.primary }}>↗</Text></View><View style={styles.flex}><Text style={[styles.rowTitle, { color: theme.text }]}>{event.user?.display_name || event.user?.username || 'Deleted user'}</Text><Text style={[styles.rowBody, { color: theme.muted }]}>{eventLabels[event.event_type] || event.event_type.replaceAll('_', ' ')}{event.page ? ` · ${event.page}` : ''}</Text><Text style={[styles.rowMeta, { color: theme.muted }]}>{shortDate(event.created_at)} · {event.platform}</Text></View></Card>)}</View>

      <SectionHeader eyebrow="ACCOUNTS" title={tr(language, 'Registered users', 'المستخدمون المسجلون')} theme={theme} />
      <View style={styles.list}>{overview.users.map((user) => <Card key={user.id} theme={theme} style={styles.row}><View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}><Text style={{ color: theme.primary, fontWeight: '900' }}>{user.display_name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.flex}><Text style={[styles.rowTitle, { color: theme.text }]}>{user.display_name}{user.role === 'super_admin' ? ' · Admin' : ''}</Text><Text numberOfLines={1} style={[styles.rowBody, { color: theme.muted }]}>@{user.username} · {user.email}</Text><Text style={[styles.rowMeta, { color: theme.muted }]}>Joined {shortDate(user.created_at)}</Text></View></Card>)}</View>

      <SectionHeader eyebrow="USER VOICE" title={tr(language, 'Feedback', 'الملاحظات')} caption={overview.feedbackEmailConfigured ? 'Email delivery is enabled.' : 'Feedback is stored securely in this dashboard.'} theme={theme} />
      <View style={styles.list}>{overview.feedback.length ? overview.feedback.map((item) => <Card key={item.id} theme={theme} style={styles.feedbackCard}><View style={styles.feedbackHead}><Text style={[styles.rowTitle, { color: theme.text }]}>{item.user?.display_name || item.user?.username || 'User'}</Text><Text style={styles.stars}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</Text></View><Text style={[styles.feedbackMessage, { color: theme.text }]}>{item.message}</Text><Text style={[styles.rowMeta, { color: theme.muted }]}>{item.category} · {shortDate(item.created_at)} · email {item.email_status.replace('_', ' ')}</Text><View style={styles.statusRow}>{(['new', 'reviewed', 'resolved'] as const).map((status) => <Pressable key={status} disabled={updatingId === item.id} onPress={() => void changeStatus(item, status)} style={[styles.statusButton, { borderColor: item.status === status ? theme.primary : theme.line, backgroundColor: item.status === status ? theme.primarySoft : theme.surface }]}><Text style={{ color: item.status === status ? theme.primary : theme.muted, fontSize: 9, fontWeight: '800', textTransform: 'capitalize' }}>{status}</Text></Pressable>)}</View></Card>) : <Text style={[styles.empty, { color: theme.muted }]}>No feedback yet.</Text>}</View>
    </> : null}
  </View>
}

const styles = StyleSheet.create({
  panel: { gap: 16 }, flex: { flex: 1 }, summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { width: '48%', minHeight: 84, padding: 13, justifyContent: 'center' }, summaryValue: { fontSize: 23, fontWeight: '900' }, summaryLabel: { marginTop: 3, fontSize: 10, fontWeight: '700' },
  list: { gap: 8 }, row: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, rowIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 12, fontWeight: '900' }, rowBody: { marginTop: 2, fontSize: 10 }, rowMeta: { marginTop: 3, fontSize: 9 }, error: { padding: 11, color: '#a63e36', borderRadius: 10, backgroundColor: '#fff0ee', fontSize: 10, fontWeight: '700' },
  feedbackCard: { padding: 13 }, feedbackHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, stars: { color: '#d39a2e', fontSize: 11 }, feedbackMessage: { marginVertical: 9, fontSize: 11, lineHeight: 17 }, statusRow: { marginTop: 10, flexDirection: 'row', gap: 6 }, statusButton: { flex: 1, minHeight: 34, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, empty: { padding: 20, textAlign: 'center', fontSize: 11 },
})
