import { supabase } from '@/integrations/supabase/client';
import { deliverFile } from '@/lib/fileExport';

const workerUrl = import.meta.env.VITE_R2_WORKER_URL?.replace(/\/$/, '');

async function authorizedRequest(path: string, init: RequestInit = {}) {
  if (!workerUrl) throw new Error('Document storage is not configured yet.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again to access document storage.');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  try {
    return await fetch(`${workerUrl}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'this app';
      throw new Error(
        `Could not connect to Vault storage from ${origin}. Check your connection and the storage service's allowed origins.`,
      );
    }
    throw error;
  }
}

export async function uploadDocumentToR2(file: File) {
  const upload = await authorizedRequest('/objects', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': file.name,
    },
    body: file,
  });
  if (!upload.ok) throw new Error((await upload.text()) || 'Could not upload the document.');
  return (await upload.json()) as { key: string; size: number };
}

export async function openDocumentFromR2(key: string) {
  const download = await authorizedRequest(`/objects?key=${encodeURIComponent(key)}`);
  if (!download.ok) throw new Error((await download.text()) || 'Could not open the document.');
  const storedName = key.split('/').pop() ?? 'document';
  const fileName = storedName.replace(/^[0-9a-f-]{36}-/i, '') || 'document';
  await deliverFile(await download.blob(), fileName, 'Open or share document');
}

export async function deleteDocumentFromR2(key: string) {
  const deletion = await authorizedRequest(`/objects?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
  if (!deletion.ok) throw new Error((await deletion.text()) || 'Could not delete the document.');
}
