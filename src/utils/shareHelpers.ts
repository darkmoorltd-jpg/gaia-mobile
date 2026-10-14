import { Linking, Alert } from 'react-native';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

function buildText(session: any): string {
  const lines = [
    '🌱 GAIA Field Report',
    '',
    `Crop: ${(session.crop || '').replace('_', ' ')}`,
    `Verdict: ${session.consensusLabel || session.consensus_label || '—'}`,
    `Confidence: ${Number(session.consensusConf || session.consensus_conf || 0).toFixed(1)}%`,
    `Severity: ${session.severity || session.severity_pct || 0}%`,
    `Frames: ${session.framesAnalyzed || session.frames_analyzed || 0}`,
    session.locationLabel || session.location_label ? `📍 ${session.locationLabel || session.location_label}` : '',
    session.gpsLat || session.gps_lat
      ? `GPS: ${(session.gpsLat || session.gps_lat).toFixed(4)}, ${(session.gpsLon || session.gps_lon).toFixed(4)}`
      : '',
    '',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    'Scanned with GAIA — Darkmoor Ltd',
  ];
  return lines.filter(Boolean).join('\n');
}

export async function shareToWhatsApp(session: any): Promise<void> {
  const text = encodeURIComponent(buildText(session));
  const url = `whatsapp://send?text=${text}`;
  try {
    const can = await Linking.canOpenURL('whatsapp://send');
    if (!can) {
      Alert.alert('WhatsApp not installed', 'Sharing via system instead.');
      return;
    }
    await Linking.openURL(url);
  } catch (e: any) {
    Alert.alert('WhatsApp share failed', e?.message || 'Try again');
  }
}

/**
 * Send SMS report via GAIA backend (Termii).
 * Falls back to native sms: link if backend fails.
 */
export async function sendSmsReport(phone: string, session: any): Promise<{ ok: boolean; err?: string }> {
  if (!phone) return { ok: false, err: 'No phone number' };
  try {
    const { data: { session: authSess } } = await supabase.auth.getSession();
    const token = authSess?.access_token;
    if (!token) return { ok: false, err: 'Not authenticated' };

    const r = await fetch(`${API_BASE}/sms/send`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone,
        message: buildText(session).slice(0, 480),
      }),
    });
    if (r.ok) return { ok: true };
    // fall back to native
    const text = encodeURIComponent(buildText(session).slice(0, 480));
    const url = `sms:${phone}?body=${text}`;
    const can = await Linking.canOpenURL('sms:' + phone);
    if (can) { await Linking.openURL(url); return { ok: true }; }
    return { ok: false, err: `HTTP ${r.status}` };
  } catch (e: any) {
    return { ok: false, err: e?.message || 'Send failed' };
  }
}

export async function shareText(text: string): Promise<void> {
  const { Share } = await import('react-native');
  try { await Share.share({ message: text }); } catch {}
}

export function buildReportText(session: any): string {
  return buildText(session);
}
