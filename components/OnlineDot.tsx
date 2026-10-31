// components/OnlineDot.tsx
'use client'
// Green if this person is in the app right now, grey if not.
import { useChat } from '@/components/ChatConnection'

export function OnlineDot({ userId }: { userId: string }) {
  const { online } = useChat()
  const isOnline = online.has(userId)
  return (
    <span
      title={isOnline ? 'Online' : 'Offline'}
      aria-label={isOnline ? 'Online' : 'Offline'}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}
    />
  )
}