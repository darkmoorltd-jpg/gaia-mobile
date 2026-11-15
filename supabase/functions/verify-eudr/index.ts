import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const auth = req.headers.get('Authorization') || '';
    const userSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return json({ ok: false, error: 'auth' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const batchId = body.batch_id;
    if (!batchId) return json({ ok: false, error: 'batch_id required' }, 400);

    const { data: batch } = await admin.from('batches').select('*').eq('id', batchId).maybeSingle();
    if (!batch) return json({ ok: false, error: 'batch not found' }, 404);
    if (!batch.farm_polygon) return json({ ok: false, error: 'no polygon' }, 400);

    const clientId = Deno.env.get('SENTINEL_CLIENT_ID');
    const clientSecret = Deno.env.get('SENTINEL_CLIENT_SECRET');
    if (!clientId || !clientSecret) return json({ ok: false, error: 'sentinel creds missing' }, 500);

    const tokenRes = await fetch('https://services.sentinel-hub.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) return json({ ok: false, error: 'sentinel auth failed' }, 500);

    const polygon = typeof batch.farm_polygon === 'string' ? JSON.parse(batch.farm_polygon) : batch.farm_polygon;
    const coords = polygon.map((p: any) => [p.lon, p.lat]);
    if (coords.length && (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1])) coords.push(coords[0]);

    const statsRes = await fetch('https://services.sentinel-hub.com/api/v1/statistics', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJson.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { bounds: { geometry: { type: 'Polygon', coordinates: [coords] }, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
                 data: [{ type: 'sentinel-2-l2a', dataFilter: { timeRange: { from: '2020-01-01T00:00:00Z', to: new Date().toISOString() }, maxCloudCoverage: 30, mosaickingOrder: 'leastCC' } }] },
        aggregation: { timeRange: { from: '2020-01-01T00:00:00Z', to: new Date().toISOString() }, aggregationInterval: { of: 'P1Y' }, evalscript: `
          //VERSION=3
          function setup() { return { input: ['B04','B08'], output: [{ id:'ndvi', bands:1, sampleType:'FLOAT32' }] }; }
          function evaluatePixel(s) { let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 0.001); return { data: [ndvi] }; }
        ` },
        calculations: { ndvi: { statistics: { mean: true }, histograms: { splitIntoBins: true, bins: 10 } } },
      }),
    });
    const statsJson = await statsRes.json();

    const ndviMean = statsJson?.data?.[0]?.outputs?.ndvi?.bands?.B0?.stats?.mean ?? null;
    const status = ndviMean === null ? 'pending' : (ndviMean > 0.4 ? 'compliant' : ndviMean > 0.2 ? 'risk' : 'fail');

    await admin.from('satellite_verifications').insert({
      batch_id: batchId, polygon, ndvi_mean: ndviMean, verification_status: status,
      verified_at: new Date().toISOString(), raw_response: statsJson,
    });

    await admin.from('batches').update({ archived_at: null }).eq('id', batchId).catch(() => {});

    return json({ ok: true, ndvi_mean: ndviMean, status });
  } catch (e: any) {
    return json({ ok: false, error: e?.message }, 500);
  }
});

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
