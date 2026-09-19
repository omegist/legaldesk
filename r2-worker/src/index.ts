interface Env {
  DOCUMENTS: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  ALLOWED_ORIGINS: string;
}

type AuthenticatedUser = { id: string };

function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim());
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : '';
  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Name',
    'Access-Control-Max-Age': '86400',
  };
}

function response(request: Request, env: Env, body: BodyInit | null, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(body, { ...init, headers });
}

async function currentUser(request: Request, env: Env): Promise<AuthenticatedUser | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const authResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization,
    },
  });
  if (!authResponse.ok) return null;
  const user = (await authResponse.json()) as Partial<AuthenticatedUser>;
  return user.id ? { id: user.id } : null;
}

function safeFileName(value: string) {
  const name = value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160);
  return name || 'upload';
}

function ownedKey(key: string, user: AuthenticatedUser) {
  return key.startsWith(`${user.id}/vault/`) && !key.includes('..');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return response(request, env, null, { status: 204 });

    const user = await currentUser(request, env);
    if (!user) return response(request, env, 'Unauthorized', { status: 401 });

    const url = new URL(request.url);
    if (url.pathname !== '/objects') return response(request, env, 'Not found', { status: 404 });

    if (request.method === 'POST') {
      const fileName = safeFileName(request.headers.get('X-File-Name') ?? 'upload');
      const contentLength = Number(request.headers.get('Content-Length') ?? 0);
      const maxFileSize = 25 * 1024 * 1024;
      if (contentLength > maxFileSize) return response(request, env, 'File exceeds the 25 MB limit.', { status: 413 });

      const body = await request.arrayBuffer();
      if (!body.byteLength) return response(request, env, 'No file supplied.', { status: 400 });
      if (body.byteLength > maxFileSize) return response(request, env, 'File exceeds the 25 MB limit.', { status: 413 });

      const key = `${user.id}/vault/${crypto.randomUUID()}-${fileName}`;
      const object = await env.DOCUMENTS.put(key, body, {
        httpMetadata: {
          contentType: request.headers.get('Content-Type') || 'application/octet-stream',
          contentDisposition: `attachment; filename="${fileName.replace(/"/g, '')}"`,
        },
        customMetadata: { ownerId: user.id },
      });
      return response(request, env, JSON.stringify({ key: object.key, size: object.size }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const key = url.searchParams.get('key') ?? '';
    if (!ownedKey(key, user)) return response(request, env, 'Forbidden', { status: 403 });

    if (request.method === 'GET') {
      const object = await env.DOCUMENTS.get(key);
      if (!object) return response(request, env, 'Not found', { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('ETag', object.httpEtag);
      return response(request, env, object.body, { headers });
    }

    if (request.method === 'DELETE') {
      await env.DOCUMENTS.delete(key);
      return response(request, env, null, { status: 204 });
    }

    return response(request, env, 'Method not allowed', { status: 405 });
  },
};
