'use client'
export default function WheelDiv({
  documentId,
  currentPage,
}: {
  documentId: string
  currentPage: number
}) {
  function handleMouseWheel() {

  }
  return <div onWheel={handleMouseWheel} className='h-10 w-50 border' />
}
