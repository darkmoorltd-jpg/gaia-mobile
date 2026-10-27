import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export const CRYPTO_PLANS = {
  starter:    { scans: 150,    usd: 2.00,  label: 'Starter — 150 scans' },
  pro:        { scans: 300,    usd: 3.50,  label: 'Pro — 300 scans' },
  business:   { scans: 1000,   usd: 6.50,  label: 'Business — 1000 scans' },
  enterprise: { scans: 5000,   usd: 13.00, label: 'Enterprise — 5000 scans' },
  unlimited:  { scans: 999999, usd: 100,   label: 'Unlimited — 1 year', annual: true },
};

export const CRYPTO_OPTIONS = [
  { key: 'usdttrc20', label: 'USDT (TRC-20)', emoji: '💎' },
  { key: 'usdterc20', label: 'USDT (ERC-20)', emoji: '💎' },
  { key: 'usdc',      label: 'USDC',          emoji: '💵' },
  { key: 'btc',       label: 'Bitcoin',       emoji: '₿' },
  { key: 'eth',       label: 'Ethereum',      emoji: 'Ξ' },
];

export async function createCryptoInvoice(plan: string, payCurrency: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');

  const r = await fetch(API_BASE + '/crypto/create-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: session.user.id,
      plan,
      pay_currency: payCurrency,
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error('HTTP ' + r.status + ': ' + txt.slice(0, 120));
  }
  const data = await r.json();
  return data as {
    invoice_id: string;
    invoice_url: string;
    order_id: string;
    amount_usd: number;
    scans: number;
  };
}

export async function payWithCrypto(plan: string, payCurrency: string) {
  try {
    const inv = await createCryptoInvoice(plan, payCurrency);
    Alert.alert(
      'Opening payment page',
      `Pay $${inv.amount_usd.toFixed(2)} in ${payCurrency.toUpperCase()} to receive ${inv.scans} scans.\n\nAfter payment, come back to the app — scans will be added automatically within a few seconds.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open', onPress: () => Linking.openURL(inv.invoice_url) },
      ],
    );
    return inv;
  } catch (e: any) {
    Alert.alert('Crypto payment failed', e?.message || 'Try again');
    return null;
  }
}
