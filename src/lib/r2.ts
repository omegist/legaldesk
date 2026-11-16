import { supabase } from '@/integrations/supabase/client';
import { deliverFile } from '@/lib/fileExport';

const workerUrl = import.meta.env.VITE_R2_WORKER_URL?.replace(/\/$/, '');

async function authorizedRequest(path: string, init: RequestInit = {}) {
  if (!workerUrl) throw new Error('Document storage is not configured yet.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again to access document storage.');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);

  // Capacitor Android WebView sometimes reports its origin as
  // "https://localhost" or "http://localhost" — the Worker CORS config
  // must include all variants. We also need `mode: 'cors'` explicitly
  // so the browser attaches the Origin header.
  const fetchInit: RequestInit = { ...init, headers, mode: 'cors' };

  // Retry once — the first cold-start fetch from a Capacitor WebView
  // can hit a transient network error or a TLS handshake timeout.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(`${workerUrl}${path}`, fetchInit);
      return resp;
    } catch (error) {
      if (attempt === 0 && error instanceof TypeError && /fetch|network|failed/i.test(error.message)) {
        // Wait 1.5 s and retry once
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      if (error instanceof TypeError && /fetch|network|failed/i.test(error.message)) {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'this app';
        throw new Error(
          `Could not connect to Vault storage from ${origin}. `
          + `Check your internet connection. If the problem persists, the storage service may need to allow this app's origin.`,
        );
      }
      throw error;
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error('Could not connect to document storage.');
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
