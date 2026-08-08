import { SignIn } from '@clerk/nextjs'
export default function SignInPage() {
  return (
    <div className='flex min-h-[80vh] items-center justify-center p-4'>
      <SignIn />
    </div>
  )
}
