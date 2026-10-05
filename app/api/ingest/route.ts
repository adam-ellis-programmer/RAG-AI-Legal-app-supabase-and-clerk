// app/api/ingest/route.ts
// Upload endpoint. Its job: check who's uploading and where the document is
// going, turn the upload into text, then hand it to the shared pipeline in
// lib/ingest.ts (clean → chunk → embed → store). The pipeline itself lives
// there so the demo seed can use exactly the same code.
import { auth } from '@clerk/nextjs/server'
import { getMatterAccess } from '@/lib/matter-access'
import { logAction } from '@/lib/audit'
import { isDemoOrg } from '@/lib/demo'
import { pdfToText, storeDocument, IngestError } from '@/lib/ingest'

// unpdf needs Node APIs; it will not run on the Edge runtime.
export const runtime = 'nodejs'
// Give the function room to process larger PDFs once deployed.
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    // ---- Who is uploading? ----
    const { userId, orgId } = await auth()
    // prettier-ignore
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    // prettier-ignore
    if (!orgId) return Response.json({ error: 'No active organization selected.' }, { status: 400 })

    if (isDemoOrg(orgId)) {
      return Response.json(
        { error: 'This is a read-only demo — uploads are disabled.' },
        { status: 403 },
      )
    }

    const form = await req.formData()
    const file = form.get('file')
    const pastedText = form.get('text')
    const sourceField = form.get('source')

    // ---- Where is it going? No matterId = firm-wide law book. ----
    const matterIdField = form.get('matterId')
    const matterId =
      typeof matterIdField === 'string' && matterIdField ? matterIdField : null

    // Layers 1 + 2: you can only upload into a case you're on the team for.
    // Checked BEFORE parsing or embedding, so a rejected upload costs nothing.
    if (matterId) {
      const access = await getMatterAccess(matterId)
      if (!access) {
        return Response.json({ error: 'Case not found.' }, { status: 404 })
      }
      if (access.matter.status !== 'open') {
        return Response.json(
          { error: 'This case is closed. Reopen it to add documents.' },
          { status: 409 },
        )
      }
    }

    // ---- Turn the upload into text: a PDF, or pasted text ----
    let rawText = ''
    let source =
      typeof sourceField === 'string' && sourceField ? sourceField : 'untitled'

    if (file && typeof file !== 'string' && file.size > 0) {
      rawText = await pdfToText(await file.arrayBuffer())
      if (source === 'untitled') source = file.name || 'uploaded.pdf'
    } else if (typeof pastedText === 'string' && pastedText.trim()) {
      rawText = pastedText
      if (source === 'untitled') source = 'pasted-text'
    } else {
      return Response.json(
        { error: 'Provide either a `file` (PDF) or a `text` field.' },
        { status: 400 },
      )
    }

    // ---- The shared pipeline: clean → chunk → embed → store ----
    const stored = await storeDocument({
      orgId,
      matterId,
      uploadedBy: userId,
      source,
      rawText,
    })

    // ---- Audit: who uploaded what, into which case ----
    await logAction({
      orgId,
      userId,
      matterId,
      action: 'document.uploaded',
      targetType: 'document',
      targetId: stored.id,
      detail: source,
    })

    return Response.json({
      id: stored.id,
      source,
      chunks: stored.chunks,
      inserted: stored.chunks,
    })
  } catch (err) {
    // A problem with the upload itself (e.g. a scanned PDF with no text): the user's to fix.
    if (err instanceof IngestError) {
      return Response.json({ error: err.message }, { status: 400 })
    }
    // Anything else is ours.
    console.error('ingest error:', err)
    return Response.json(
      { error: 'Ingestion failed. Check server logs.' },
      { status: 500 },
    )
  }
}