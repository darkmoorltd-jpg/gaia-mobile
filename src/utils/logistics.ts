import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../api/supabase';

export function eudrPdfUrl(batchCode: string): string {
  return `https://gaia.ng/trace/${batchCode}`;
}

export interface DispatchPayload {
  movement_id: string;
  driver_id: string;
}

export async function apiDispatch(payload: DispatchPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('dispatch-logistics', { body: payload });
    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'dispatch failed' };
  }
}

export interface EUDRBatchInput {
  batch_code: string;
  crop_name: string;
  quantity_kg: number;
  harvest_date: string;
  farmer_name?: string;
  farmer_state?: string;
  farmer_lga?: string;
  farm_area_hectares?: number;
  gps_lat?: number;
  gps_lon?: number;
  farm_polygon?: any;
  events?: { event_type: string; created_at: string; notes?: string }[];
  movements?: { origin_location?: string; destination_location?: string; dispatched_at?: string; arrived_at?: string }[];
}

export async function generateEUDRPdf(batch: EUDRBatchInput): Promise<string | null> {
  const eventsHtml = (batch.events || []).map((e) => `
    <tr><td>${esc(e.event_type.toUpperCase())}</td>
        <td>${esc(new Date(e.created_at).toLocaleString())}</td>
        <td>${esc(e.notes || '')}</td></tr>
  `).join('');

  const movesHtml = (batch.movements || []).map((m) => `
    <tr><td>${esc(m.origin_location || '?')}</td>
        <td>${esc(m.destination_location || '?')}</td>
        <td>${esc(m.dispatched_at ? new Date(m.dispatched_at).toLocaleString() : '')}</td>
        <td>${esc(m.arrived_at ? new Date(m.arrived_at).toLocaleString() : '')}</td></tr>
  `).join('');

  const polyStr = batch.farm_polygon
    ? JSON.stringify(batch.farm_polygon).slice(0, 200) + '...'
    : 'Polygon not captured';

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 24pt; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; }
    h1 { color: #1b5e20; font-size: 22px; margin: 0 0 6px; }
    h2 { color: #1b5e20; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;
         border-bottom: 1.5px solid #4caf50; padding-bottom: 4px; margin: 20px 0 10px; }
    .kicker { font-size: 10px; letter-spacing: 2px; color: #666; }
    .badge { display: inline-block; padding: 6px 10px; background: #e8f5e9; color: #1b5e20;
             border: 1px solid #4caf50; border-radius: 6px; font-size: 11px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eee; }
    th { background: #f1f8e9; color: #1b5e20; font-size: 10px; letter-spacing: 1px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .cell { background: #f9fbe7; padding: 10px; border-radius: 6px; }
    .cell .lbl { font-size: 9px; letter-spacing: 1px; color: #666; }
    .cell .val { font-size: 14px; font-weight: 700; color: #111; margin-top: 2px; }
    .footer { margin-top: 30px; font-size: 9px; color: #888; text-align: center; border-top: 1px solid #ddd; padding-top: 12px; }
  </style></head><body>

  <div class="kicker">GAIA TRACEABILITY · EUDR DUE DILIGENCE</div>
  <h1>${esc(batch.crop_name)} — ${esc(batch.batch_code)}</h1>
  <div class="badge">DEFORESTATION-FREE DECLARATION</div>

  <h2>Batch</h2>
  <div class="grid">
    <div class="cell"><div class="lbl">CROP</div><div class="val">${esc(batch.crop_name)}</div></div>
    <div class="cell"><div class="lbl">QUANTITY</div><div class="val">${Number(batch.quantity_kg).toLocaleString()} kg</div></div>
    <div class="cell"><div class="lbl">HARVEST DATE</div><div class="val">${esc(batch.harvest_date)}</div></div>
    <div class="cell"><div class="lbl">FARM AREA</div><div class="val">${batch.farm_area_hectares ? batch.farm_area_hectares.toFixed(2) + ' ha' : '—'}</div></div>
  </div>

  <h2>Origin</h2>
  <table><tbody>
    <tr><th>Farmer</th><td>${esc(batch.farmer_name || '—')}</td></tr>
    <tr><th>Location</th><td>${esc([batch.farmer_lga, batch.farmer_state].filter(Boolean).join(', ') || '—')}</td></tr>
    <tr><th>GPS</th><td>${batch.gps_lat ? batch.gps_lat.toFixed(5) + ', ' + batch.gps_lon?.toFixed(5) : '—'}</td></tr>
    <tr><th>Polygon</th><td>${esc(polyStr)}</td></tr>
  </tbody></table>

  <h2>Chain of Custody (${(batch.events || []).length} events)</h2>
  <table><thead><tr><th>Event</th><th>When</th><th>Notes</th></tr></thead>
         <tbody>${eventsHtml || '<tr><td colspan="3">No events</td></tr>'}</tbody></table>

  <h2>Movements (${(batch.movements || []).length})</h2>
  <table><thead><tr><th>From</th><th>To</th><th>Dispatched</th><th>Arrived</th></tr></thead>
         <tbody>${movesHtml || '<tr><td colspan="4">No movements</td></tr>'}</tbody></table>

  <div class="footer">
    Generated ${new Date().toLocaleString()} · GAIA by Darkmoor Ltd · gaia.ng · NDFR-compatible
    · This document asserts the batch was harvested after 31 December 2020 in compliance with EUDR Annex II.
  </div>
  </body></html>`;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (e) {
    console.warn('EUDR PDF failed', e);
    return null;
  }
}

export async function shareEUDRPdf(batch: EUDRBatchInput): Promise<boolean> {
  const uri = await generateEUDRPdf(batch);
  if (!uri) return false;
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'EUDR Due Diligence' });
    return true;
  } catch { return false; }
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
