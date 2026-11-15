import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const tripId = body.trip_id;
    if (!tripId) return json({ ok: false, error: 'trip_id' }, 400);

    const { data: trip } = await admin.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (!trip) return json({ ok: false, error: 'not found' }, 404);

    const { data: recentLocs } = await admin.from('driver_locations')
      .select('lat, lon, speed_mps, recorded_at')
      .eq('movement_id', trip.movement_id)
      .order('recorded_at', { ascending: false })
      .limit(20);

    if (!recentLocs || recentLocs.length < 2) return json({ ok: true, anomalies: [] });

    const anomalies: any[] = [];
    const origin = { lat: trip.origin_lat, lon: trip.origin_lon };
    const dest = { lat: trip.destination_lat, lon: trip.destination_lon };
    if (!origin.lat || !dest.lat) return json({ ok: true, anomalies: [] });

    const dist = (a: any, b: any) => Math.sqrt(Math.pow((a.lat-b.lat)*111,2) + Math.pow((a.lon-b.lon)*111*Math.cos(a.lat*Math.PI/180),2));
    const lineDist = dist(origin, dest);

    for (const loc of recentLocs) {
      const d = dist(loc, origin) + dist(loc, dest) - lineDist;
      if (d > 50) { anomalies.push({ type: 'route_deviation', km: d, at: loc.recorded_at }); break; }
    }

    const fast = recentLocs.filter((l: any) => Number(l.speed_mps || 0) > 30);
    if (fast.length >= 3) anomalies.push({ type: 'overspeed', count: fast.length });

    const recent = recentLocs.slice(0, 5);
    if (recent.length >= 5 && recent.every((l: any) => Number(l.speed_mps || 0) < 0.5)) {
      const stoppedMin = (new Date(recent[0].recorded_at).getTime() - new Date(recent[4].recorded_at).getTime()) / 60000;
      if (stoppedMin > 60) anomalies.push({ type: 'long_stop', minutes: stoppedMin });
    }

    if (anomalies.length > 0) {
      await admin.from('event_queue').insert({
        event_type: 'trip.anomaly', aggregate_type: 'trip', aggregate_id: tripId,
        payload: { anomalies },
      });
    }

    return json({ ok: true, anomalies });
  } catch (e: any) {
    return json({ ok: false, error: e?.message }, 500);
  }
});

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
