import { supabase } from '../api/supabase';

const API = 'https://gaia-api-xuly.onrender.com';

async function authHeaders() {
  const s = await supabase.auth.getSession();
  const token = s.data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    Authorization: token ? 'Bearer ' + token : '',
  };
}

export interface WalletInfo {
  balance: number;
  escrow: number;
  account_number: string | null;
  account_name: string | null;
  bank_name: string | null;
  provisioned: boolean;
}

export interface WalletTxn {
  id: string;
  type: string;
  direction: string;
  amount: number;
  balance_after: number | null;
  status: string;
  reference: string;
  counterparty_name: string | null;
  counterparty_acct: string | null;
  failure_reason: string | null;
  created_at: string;
}

export async function walletMe() {
  try {
    const r = await fetch(API + '/wallet/me', { headers: await authHeaders() });
    if (!r.ok) return null;
    const d = await r.json();
    const raw = d.wallet || {};
    return {
      wallet: {
        balance: Number(raw.balance || 0),
        escrow: Number(raw.escrow_balance || 0),
        account_number: raw.account_number || null,
        account_name: raw.account_name || null,
        bank_name: raw.bank_name || null,
        provisioned: !!raw.account_number,
      } as WalletInfo,
      transactions: (d.transactions || []) as WalletTxn[],
    };
  } catch { return null; }
}

export async function provisionWallet(input: any) {
  const r = await fetch(API + '/wallet/provision', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'Provision failed');
  return d;
}

export async function depositInit(amount_naira: number) {
  const r = await fetch(API + '/wallet/deposit/init', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ amount_naira: amount_naira }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'Init failed');
  return d;
}

export async function depositVerify(reference: string) {
  const r = await fetch(API + '/wallet/deposit/verify', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ reference: reference }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'Verify failed');
  return d;
}

export async function sendToUser(identifier: string, amount_naira: number, note?: string) {
  const r = await fetch(API + '/wallet/send/user', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ identifier: identifier, amount_naira: amount_naira, note: note || null }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'Send failed');
  return d;
}

export async function resolveAccount(account_number: string, bank_code: string) {
  const r = await fetch(API + '/wallet/resolve', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ account_number: account_number, bank_code: bank_code }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'Resolve failed');
  return d;
}

export async function fetchBanks() {
  try {
    const r = await fetch(API + '/wallet/banks');
    if (!r.ok) return [];
    const d = await r.json();
    return d.banks || [];
  } catch { return []; }
}

export async function withdrawToBank(input: any) {
  const r = await fetch(API + '/wallet/withdraw', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'Withdraw failed');
  return d;
}

export function fmtN(n: any, dp: number = 2) {
  return 'N' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function relTime(iso: string) {
  try {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString();
  } catch { return ''; }
}
