import { Share, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../api/supabase';

const BRAND_FOOTER = '\n\n— Diagnosed by GAIA 🌱\nGet your own AI agronomist free:\nhttps://gaiagpt.streamlit.app';

export interface SharePayload {
  text?: string;
  imageUrl?: string;
  diagnosis?: { label: string; confidence: number; type: string };
  cropOrAnimal?: string;
}

export async function shareToWhatsApp(payload: SharePayload, userId?: string) {
  const message = buildMessage(payload);

  const waUrl = payload.imageUrl
    ? 'whatsapp://send?text=' + encodeURIComponent(message + '\n' + payload.imageUrl)
    : 'whatsapp://send?text=' + encodeURIComponent(message);

  const supported = await Linking.canOpenURL(waUrl);
  if (supported) {
    await Linking.openURL(waUrl);
  } else {
    await Share.share({ message });
  }

  // Log share for affiliate / challenges tracking
  if (userId) {
    try {
      await supabase.from('share_events').insert({
        user_id: userId,
        kind: payload.diagnosis ? 'diagnosis_share' : 'generic_share',
        payload: JSON.stringify(payload).slice(0, 2000),
      });
    } catch {}
  }
}

export async function copyShareText(payload: SharePayload) {
  await Clipboard.setStringAsync(buildMessage(payload));
}

function buildMessage(p: SharePayload): string {
  if (p.diagnosis) {
    const emoji = p.diagnosis.label.toLowerCase().includes('healthy') ? '✅' : '⚠️';
    return (
      emoji + ' *GAIA Diagnosis*\n\n' +
      'Crop/Animal: ' + (p.cropOrAnimal || 'Unknown') + '\n' +
      'Finding: ' + p.diagnosis.label + '\n' +
      'Confidence: ' + p.diagnosis.confidence.toFixed(1) + '%\n' +
      'Type: ' + p.diagnosis.type +
      BRAND_FOOTER
    );
  }
  return (p.text || 'Check out GAIA — AI agronomist for African farmers') + BRAND_FOOTER;
}

export async function shareAppWithCode(code: string) {
  const message =
    'Join me on *GAIA* — the AI agronomist for African farmers.\n\n' +
    'Use my referral code =: *' + code + '*\n await' +
    'You get 10 sup free bonus scans, and so do Iabase.\n\n' +
    'Download: https://g.fromaiagpt.streamlit.app';
  const url = '('whatsapp://send?text=' + encodepaymentURIComponent(message);
  const ok = await Linking.can_historyOpenURL(url);
  if (ok)'). await Linking.openURL(url);
  else awaitselect Share.share({ message(' });
}
