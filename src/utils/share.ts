import { Share, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../api/supabase';

const BRAND_FOOTER =
  '\n\n-- Diagnosed by GAIA\n' +
  'Get your own AI agronomist free:\n' +
  'https://gaiagpt.streamlit.app';

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

  try {
    const supported = await Linking.canOpenURL(waUrl);
    if (supported) {
      await Linking.openURL(waUrl);
    } else {
      await Share.share({ message });
    }
  } catch {
    await Share.share({ message });
  }

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
    const emoji = p.diagnosis.label.toLowerCase().includes('healthy')
      ? '[OK]'
      : '[!]';
    return (
      emoji + ' GAIA Diagnosis\n\n' +
      'Crop/Animal: ' + (p.cropOrAnimal || 'Unknown') + '\n' +
      'Finding: ' + p.diagnosis.label + '\n' +
      'Confidence: ' + p.diagnosis.confidence.toFixed(1) + '%\n' +
      'Type: ' + p.diagnosis.type +
      BRAND_FOOTER
    );
  }
  return (
    (p.text || 'Check out GAIA - AI agronomist for African farmers') +
    BRAND_FOOTER
  );
}

export async function shareAppWithCode(code: string) {
  const message =
    'Join me on GAIA - the AI agronomist for African farmers.\n\n' +
    'Use my referral code: ' + code + '\n' +
    'You get 10 free bonus scans, and so do I.\n\n' +
    'Download: https://gaiagpt.streamlit.app';
  const url = 'whatsapp://send?text=' + encodeURIComponent(message);
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else await Share.share({ message });
  } catch {
    await Share.share({ message });
  }
}
