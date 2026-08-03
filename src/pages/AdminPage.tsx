import { useCallback, useEffect, useState } from 'react'
import { Activity, MessageSquareText, RefreshCw, ShieldCheck, UserRoundCheck, UsersRound } from 'lucide-react'
import { loadCloudAdminOverview, updateCloudFeedbackStatus, type AdminFeedback, type AdminOverview } from '../services/cloud'

const eventLabels: Record<string, string> = {
  account_created: 'Created an account',
  sign_in: 'Signed in',
  app_open: 'Opened Tawazon',
  page_view: 'Viewed a page',
  profile_updated: 'Updated profile',
  feedback_submitted: 'Sent feedback',
  workout_preference_changed: 'Changed workout plan',
}

function eventUser(event: AdminOverview['events'][number]) {
  return event.user?.display_name || event.user?.username || 'Deleted user'
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setOverview(await loadCloudAdminOverview()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load admin activity.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function setFeedbackStatus(feedback: AdminFeedback, status: AdminFeedback['status']) {
    setUpdatingId(feedback.id)
    try {
      const response = await updateCloudFeedbackStatus(feedback.id, status)
      setOverview((current) => current ? { ...current, feedback: current.feedback.map((item) => item.id === feedback.id ? { ...item, ...response.feedback } : item) } : current)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update feedback.')
    } finally { setUpdatingId('') }
  }

  return (
    <div className="admin-page">
      <section className="feature-intro admin-intro">
        <div><span className="status-pill"><ShieldCheck size={14} /> Super admin</span><h2>User activity & feedback</h2><p>Review account activity without exposing passwords, recovery codes, diet-plan files, or private health values.</p></div>
        <button className="admin-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh</button>
      </section>

      {error && <p className="admin-error">{error}</p>}
      {loading && !overview ? <div className="admin-loading card-surface"><RefreshCw className="spin" size={22} /> Loading secure activity…</div> : null}
      {overview ? <>
        <section className="admin-summary">
          <article className="card-surface"><span><UsersRound size={20} /></span><div><b>{overview.summary.totalUsers}</b><small>Total users</small></div></article>
          <article className="card-surface"><span><UserRoundCheck size={20} /></span><div><b>{overview.summary.active24h}</b><small>Active in 24 hours</small></div></article>
          <article className="card-surface"><span><Activity size={20} /></span><div><b>{overview.summary.events7d}</b><small>Events in 7 days</small></div></article>
          <article className="card-surface"><span><MessageSquareText size={20} /></span><div><b>{overview.summary.newFeedback}</b><small>New feedback</small></div></article>
        </section>

        <section className="admin-grid">
          <article className="admin-panel card-surface">
            <header><div><small>LIVE AUDIT</small><h3>Recent activity</h3></div><span>{overview.events.length} events</span></header>
            <div className="admin-event-list">{overview.events.length ? overview.events.map((event) => <div className="admin-event" key={event.id}><span className="admin-event-icon"><Activity size={15} /></span><div><b>{eventUser(event)}</b><p>{eventLabels[event.event_type] || event.event_type.replaceAll('_', ' ')}{event.page ? ` · ${event.page}` : ''}</p><small>{shortDate(event.created_at)} · {event.platform}</small></div></div>) : <p className="admin-empty">No activity has been recorded yet.</p>}</div>
          </article>

          <article className="admin-panel card-surface">
            <header><div><small>ACCOUNTS</small><h3>Registered users</h3></div><span>{overview.users.length} users</span></header>
            <div className="admin-user-list">{overview.users.map((user) => <div className="admin-user" key={user.id}><span>{user.display_name.slice(0, 1).toUpperCase()}</span><div><b>{user.display_name}</b><p>@{user.username} · {user.email}</p><small>Joined {shortDate(user.created_at)}</small></div>{user.role === 'super_admin' && <em>Admin</em>}</div>)}</div>
          </article>
        </section>

        <section className="admin-panel admin-feedback-panel card-surface">
          <header><div><small>USER VOICE</small><h3>Feedback & experience</h3></div><span className={overview.feedbackEmailConfigured ? 'email-ready' : 'email-pending'}>{overview.feedbackEmailConfigured ? 'Email delivery on' : 'Stored in dashboard'}</span></header>
          <div className="admin-feedback-list">{overview.feedback.length ? overview.feedback.map((item) => <article className="admin-feedback" key={item.id}><div className="admin-feedback-head"><div><b>{item.user?.display_name || item.user?.username || 'User'}</b><span>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span></div><small>{shortDate(item.created_at)}</small></div><p>{item.message}</p><footer><span>{item.category} · {item.platform} · email {item.email_status.replace('_', ' ')}</span><select aria-label="Feedback status" value={item.status} disabled={updatingId === item.id} onChange={(event) => void setFeedbackStatus(item, event.target.value as AdminFeedback['status'])}><option value="new">New</option><option value="reviewed">Reviewed</option><option value="resolved">Resolved</option></select></footer></article>) : <p className="admin-empty">No user feedback has arrived yet.</p>}</div>
        </section>
      </> : null}
    </div>
  )
}
