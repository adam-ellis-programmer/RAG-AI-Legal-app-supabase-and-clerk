// components/SubmitButton.tsx
'use client'

import { useFormStatus } from 'react-dom'

type Props = {
  children: React.ReactNode
  pendingText?: string
  className?: string
}

/**
 * A submit button that disables itself while its form's server action runs.
 * Prevents double/triple submits (duplicate cases, duplicate logs).
 * Must be rendered INSIDE a <form> — useFormStatus reads the nearest parent form.
 */
export function SubmitButton({ children, pendingText = 'Saving…', className }: Props) {
  const { pending } = useFormStatus()

  return (
    <button
      type='submit'
      disabled={pending}
      aria-disabled={pending}
      className={`${className ?? ''} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingText : children}
    </button>
  )
}