// app/app/documents/actions.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { documentFiles } from '@/lib/schema'
import { getMatterAccess, isUuid } from '@/lib/matter-access'
import { logAction } from '@/lib/audit'

// prettier-ignore
export async function deleteDocument(formData: FormData) {
  const { userId, orgId, has } = await auth()
  if (!userId || !orgId) throw new Error('Not authorized')

  const fileId = String(formData.get('fileId') || '')
  if (!isUuid(fileId)) return

  // Layer 1: the file must belong to this firm.
  const [file] = await db
    .select({
      id: documentFiles.id,
      source: documentFiles.source,
      matterId: documentFiles.matterId,
      uploadedBy: documentFiles.uploadedBy,
    })
    .from(documentFiles)
    .where(and(eq(documentFiles.id, fileId), eq(documentFiles.orgId, orgId)))
    .limit(1)
  if (!file) throw new Error('Document not found')

  if (file.matterId) {
    // Case document: only that case's admins.
    const access = await getMatterAccess(file.matterId)
    if (!access || access.membership.role !== 'admin') {
      throw new Error('Only case admins can delete case documents')
    }
  } else {
    // Firm library: whoever uploaded it, or an org admin.
    const isOrgAdmin = has({ role: 'org:admin' })
    if (!isOrgAdmin && file.uploadedBy !== userId) {
      throw new Error('Only the uploader or a firm admin can delete library documents')
    }
  }

  // Deleting the file removes its chunks too (onDelete: 'cascade').
  await db.delete(documentFiles).where(eq(documentFiles.id, file.id))

  await logAction({
    orgId,
    userId,
    matterId: file.matterId,
    action: 'document.deleted',
    targetType: 'document',
    targetId: file.id,
    detail: file.source,
  })

  if (file.matterId) revalidatePath(`/app/matters/${file.matterId}`)
  else revalidatePath('/app/documents')
}
