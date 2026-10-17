import { Linking, Alert } from 'react-native';

/** Normalize Nigerian phone to wa.me format (234XXX). */
function waNumber(raw: string): string {
  const d = (raw || '').replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.startsWith('0')) return '234' + d.slice(1);
  if (d.startsWith('234')) return d;
  return '234' + d;
}

/** Open WhatsApp with a pre-filled message to a farmer. */
export async function shareFarmerViaWhatsApp(
  farmerPhone: string,
  farmerName: string,
  uniqueId: string,
  agentCode: string,
): Promise<boolean> {
  const number = waNumber(farmerPhone);
  if (!number) {
    Alert.alert('No phone number', 'This farmer has no phone number on record.');
    return false;
  }
  const text = `Hello ${farmerName || 'Farmer'}, this is your GAIA verification team.\n\nYour Farmer ID: ${uniqueId}\nVerified by agent: ${agentCode}\n\nLog in to GAIA with your registered phone to access your profile, scans, and market listings.\n\n- Darkmoor Ltd`;
  const url = `whatsapp://send?phone=${number}&text=${encodeURIComponent(text)}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      // fallback to wa.me web
      const web = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
      await Linking.openURL(web);
    } else {
      await Linking.openURL(url);
    }
    return true;
  } catch (e: any) {
    Alert.alert('WhatsApp not available', e?.message || 'Install WhatsApp to send this message.');
    return false;
  }
}
