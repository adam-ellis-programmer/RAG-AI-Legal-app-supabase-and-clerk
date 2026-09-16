'use client'
export default function WheelDiv({
  documentId,
  currentPage,
}: {
  documentId: string
  currentPage: number
}) {
  function handleMouseWheel() {
    console.log('wheel on', documentId, 'page', currentPage)
  }
  return <div onWheel={handleMouseWheel} className='h-10 w-50 border' />
}
