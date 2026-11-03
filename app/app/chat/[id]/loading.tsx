// app/app/chat/[id]/loading.tsx
// Shown the moment you click a conversation, while the server loads it.
export default function Loading() {
  return (
    <div className='grid gap-6 lg:grid-cols-[1fr_260px]'>
      <div className='h-[65vh] animate-pulse rounded-xl border border-slate-200 bg-slate-50' />
      <div className='h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-50' />
    </div>
  )
}
