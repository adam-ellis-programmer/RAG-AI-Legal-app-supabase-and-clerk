// components/CaseActivity.tsx
// The case's audit trail, written as sentences a case lead can read.
// Pure rendering (no hooks), so it works inside the server-rendered case page.
import Link from 'next/link'

export type ActivityEntry = {
  id: string
  userId: string
  userName: string | null // snapshot from when it happened
  action: string
  targetType: string | null
  targetId: string | null
  detail: string | null
  createdAt: Date
}

// prettier-ignore
export const ACTIVITY_FILTERS = {
  all: null,
   documents: ['document.uploaded', 'document.view', 'document.deleted'],
  questions: ['query.ask'],
  team: ['matter.created', 'member.added', 'member.removed', 'member.role_changed', 'matter.status_changed'],
} as const

export type ActivityFilter = keyof typeof ACTIVITY_FILTERS

const FILTER_LABELS: Record<ActivityFilter, string> = {
  all: 'All',
  documents: 'Documents',
  questions: 'Questions',
  team: 'Team',
}

// Turn one log row into "verb + linked object".
function describe(e: ActivityEntry, matterId: string) {
  const docHref = e.targetId ? `/app/documents/${e.targetId}` : null
  //   prettier-ignore
  switch (e.action) {
    case 'matter.created':
      return { verb: 'opened this case', label: null, href: null }
    case 'member.added':
      return { verb: 'added to the team:', label: e.detail, href: null }
      case 'member.removed':
      return { verb: 'removed from the team:', label: e.detail, href: null }  
    case 'member.role_changed':
      return { verb: 'changed a role:', label: e.detail, href: null }   
    case 'matter.status_changed':
      return { verb: 'changed the case status:', label: e.detail, href: null }
    case 'document.uploaded':
      return { verb: 'uploaded', label: e.detail, href: docHref }
    case 'document.view':
      return { verb: 'opened', label: e.detail, href: docHref }   
    case 'document.deleted':
      return { verb: 'deleted', label: e.detail, href: null }
    case 'query.ask':
      return {
        verb: 'asked',
        label: e.detail ? `“${e.detail}”` : 'a question',
        href: e.targetType === 'query' && e.targetId ? `/app/matters/${matterId}/queries/${e.targetId}#turn-${e.targetId}` : null,
      }
    default:
      return { verb: e.action, label: e.detail, href: null }
  }
}

function when(d: Date) {
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CaseActivity({
  matterId,
  entries,
  names,
  filter,
}: {
  matterId: string
  entries: ActivityEntry[]
  names: Record<string, string> // current names from Clerk, by userId
  filter: ActivityFilter
}) {
  return (
    // prettier-ignore
    <div>
        {/* Why admins only? Seeing who read which document is itself sensitive. A junior on the case doesn't need to monitor colleagues. To show it to the whole team, remove isAdmin && and the isAdmin ? condition in the query. */}
        {/* Why filters use links, not buttons. Each filter is a URL (?activity=documents), so it works without JavaScript, survives a refresh, and can be shared. scroll={false} plus #activity keeps you at the panel rather than jumping to the top of the page. */}
        {/* Clicking a document in the activity list logs a new view. That's correct: it is a real view. prefetch={false} makes sure only a click counts, not the link scrolling into sight. */}
        {/* It only shows case-level events. client.created has no matter_id, so it never appears here. That belongs on a firm-wide activity page, if you ever build one. */}
      <nav className='mb-3 flex flex-wrap gap-1' aria-label='Filter activity'>
        {(Object.keys(ACTIVITY_FILTERS) as ActivityFilter[]).map((key) => (
          <Link key={key} href={key === 'all' ? `/app/matters/${matterId}#activity` : `/app/matters/${matterId}?activity=${key}#activity`} scroll={false}  aria-current={filter === key ? 'page' : undefined} className={`rounded-md px-2.5 py-1 text-xs ${filter === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {FILTER_LABELS[key]}
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <p className='text-sm text-slate-500'>Nothing recorded here yet.</p>
      ) : (
        // prettier-ignore
        <ol className='divide-y divide-slate-100 rounded-xl border border-slate-200'>
          {entries.map((e) => {
            const { verb, label, href } = describe(e, matterId)
            // Current name if they're still in the firm; otherwise the name
            // recorded at the time, so leavers stay identifiable.
            const who = names[e.userId] ?? e.userName ?? 'Unknown user'
            return (
              <li key={e.id} className='flex items-baseline gap-3 px-3 py-2 text-sm'>
                <span className='min-w-0 flex-1 text-slate-600'>
                  <span className='font-medium text-slate-900'>{who}</span> {verb}{' '}
                  {label &&
                    (href ? (
                      <Link href={href} prefetch={false} className='text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600'>
                        {label}
                      </Link>
                    ) : (
                      <span className='text-slate-900'>{label}</span>
                    ))}

                </span>
                <time dateTime={new Date(e.createdAt).toISOString()} className='shrink-0 text-xs text-slate-400'>
                  {when(e.createdAt)}
                </time>
              </li>
            )
          })}
        </ol>
      )}

      {entries.length === 50 && (
        <p className='mt-2 text-xs text-slate-400'>Showing the latest 50.</p>
      )}
    </div>
  )
}
