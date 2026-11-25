// app/app/chat/page.tsx
// What the conversation area shows before one is picked. The list itself is in
// layout.tsx; this file is only the "nothing selected yet" state.
export default function ChatHome() {
  return (
    <div className='rounded-xl border border-dashed border-slate-300 p-10 text-center'>
      <p className='text-sm text-slate-500'>Pick a conversation to start.</p>
    </div>
  )
}