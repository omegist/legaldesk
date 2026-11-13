import { supabase } from '@/integrations/supabase/client';
import { deleteDocumentFromR2, uploadDocumentToR2 } from '@/lib/r2';

/** Stores a generated legal PDF in the signed-in user's private Vault. */
export async function saveGeneratedPdfToVault(file: Blob, fileName: string, ownerId: string) {
  const pdf = new File([file], fileName, { type: 'application/pdf' });
  const { key } = await uploadDocumentToR2(pdf);
  const { error } = await supabase.from('documents').insert({
    owner_id: ownerId,
    diary_id: null,
    category: 'filed_plaints',
    file_name: fileName,
    storage_key: key,
    mime_type: 'application/pdf',
    file_size: pdf.size,
    notes: 'Generated from VakilDesk document templates.',
  });

  if (error) {
    try {
      await deleteDocumentFromR2(key);
    } catch {
      // Preserve the original database error; the orphaned object can be cleaned up separately.
    }
    throw new Error(error.message || 'Could not save the generated document to your Vault.');
  }
}
