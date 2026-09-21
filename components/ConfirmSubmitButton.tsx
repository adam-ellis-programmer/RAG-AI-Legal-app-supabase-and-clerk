// components/ConfirmSubmitButton.tsx
'use client'

import { useFormStatus } from 'react-dom'

// A submit button that asks for confirmation before a destructive action,
// then disables itself while the server action runs.
export function ConfirmSubmitButton({
  children,
  message,
  pendingText = 'Working…',
  className,
}: {
  children: React.ReactNode
  message: string
  pendingText?: string
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type='submit'
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault()
      }}
      className={`${className ?? ''} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingText : children}
    </button>
  )
}
