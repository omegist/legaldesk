// Diagnostic only — call this once with a real CNR number to see exactly
// what eCourtsIndia's API returns, before we build the real sync logic
// around it in Step 3.

const ECOURTSINDIA_API_KEY = Deno.env.get('ECOURTSINDIA_API_KEY')!;

Deno.serve(async (req) => {
  try {
    const { cnr } = await req.json();
    if (!cnr) return json({ error: 'Pass a cnr in the request body' }, 400);

        const res = await fetch(`https://webapi.ecourtsindia.com/api/partner/case/${cnr}`, {
      headers: { Authorization: `Bearer ${ECOURTSINDIA_API_KEY}` },
    });

    const text = await res.text();
    console.log('eCourtsIndia raw response:', text);

    return json({ status: res.status, body: text });
  } catch (err) {
    console.error('test-cnr-lookup error:', err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}