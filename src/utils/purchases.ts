import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export interface Plan {
  key: string;
  name: string;
  scans: number;
  amount_kobo: number;
}

export async function fetchPlans(): Promise<Plan[]> {
  try {
    const r = await fetch(API_BASE + '/plans');
    if (!r.ok) return [];
    const d = await r.json();
    return d.plans || [];
  } catch {
    return [];
  }
}

export async function verifyPurchase(reference: string, plan: string): Promise<any> {
  const sess = await supabase.auth.getSession();
  const token = sess.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const r = await fetch(API_BASE + '/verify-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({ reference: reference, plan: plan }),
  });

  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'Verify failed (' + r.status + ')');
  return d;
}

export function newRef(planKey: string, userId: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return 'GAIA_' + planKey.toUpperCase() + '_' + userId.slice(0, 6) + '_' + Date.now().toString(36) + rand;
}

export async function initiateFlutterwave(planKey: string, currency: string = 'NGN'): Promise<{ checkout_url: string; tx_ref: string }> {
  const sess = await supabase.auth.getSession();
  const token = sess.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const r = await fetch(API_BASE + '/payment/flutterwave/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ plan: planKey, currency }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'FLW initiate failed (' + r.status + ')');
  return d;
}

export async function verifyFlutterwave(txRef: string, planKey: string): Promise<any> {
  const sess = await supabase.auth.getSession();
  const token = sess.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const r = await fetch(API_BASE + '/payment/flutterwave/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ reference: txRef, plan: planKey }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'FLW verify failed (' + r.status + ')');
  return d;
}
