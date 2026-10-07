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

export async function sendToUser(identifier: string, amount_naira: number, note?: string, pin?: string) {
  const r = await fetch(API + '/wallet/send/user', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ identifier: identifier, amount_naira: amount_naira, note: note || null, pin: pin || '' }),
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


export async function buyScansWithWallet(plan: string, pin: string) {
  const r = await fetch(API + '/wallet/buy-scans', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ plan: plan, pin: pin }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'Purchase failed');
  return d;
}

export async function walletStatement(limit: number = 100) {
  const r = await fetch(API + '/wallet/statement?limit=' + limit, { headers: await authHeaders() });
  if (!r.ok) return [];
  const d = await r.json();
  return d.transactions || [];
}

export async function walletReceipt(reference: string) {
  const r = await fetch(API + '/wallet/receipt/' + reference, { headers: await authHeaders() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'Receipt failed');
  return d;
}

export async function verifyPin(pin: string) {
  const r = await fetch(API + '/wallet/verify-pin', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ pin: pin }),
  });
  return r.ok;
}

export async function setWalletPin(pin: string) {
  const r = await fetch(API + '/wallet/set-pin', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ pin: pin }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'Set PIN failed');
  return true;
}

export async function hasWalletPin() {
  try {
    const r = await fetch(API + '/wallet/has-pin', { headers: await authHeaders() });
    if (!r.ok) return false;
    const d = await r.json();
    return !!d.has_pin;
  } catch { return false; }
}


export async function resetPinWithPassword(password: string, new_pin: string) {
  const r = await fetch(API + '/wallet/reset-pin', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ password: password, new_pin: new_pin }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.error || 'Reset failed');
  return d;
}

// ============================================================
// PDF download + preferences
// ============================================================

export interface StatementRange {
  days?: number;
  date_from?: string;
  date_to?: string;
}

function _qs(r: StatementRange): string {
  if (r.date_from && r.date_to) {
    return '?date_from=' + encodeURIComponent(r.date_from) + '&date_to=' + encodeURIComponent(r.date_to);
  }
  return '?days=' + (r.days || 90);
}

export async function downloadStatementPDF(range: StatementRange = { days: 90 }): Promise<string | null> {
  const s = await supabase.auth.getSession();
  const token = s.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const FS = await import('expo-file-system/legacy');
  const path = FS.cacheDirectory + 'gaia-statement-' + Date.now() + '.pdf';
  const r = await FS.downloadAsync(
    API + '/wallet/statement/pdf' + _qs(range),
    path,
    { headers: { Authorization: 'Bearer ' + token } },
  );
  if (r.status !== 200) throw new Error('Download failed: ' + r.status);
  return r.uri;
}

export async function downloadStatementJPG(range: StatementRange = { days: 90 }): Promise<string | null> {
  const s = await supabase.auth.getSession();
  const token = s.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const FS = await import('expo-file-system/legacy');
  const path = FS.cacheDirectory + 'gaia-statement-' + Date.now() + '.jpg';
  const r = await FS.downloadAsync(
    API + '/wallet/statement/jpg' + _qs(range),
    path,
    { headers: { Authorization: 'Bearer ' + token } },
  );
  if (r.status !== 200) throw new Error('Download failed: ' + r.status);
  return r.uri;
}

export async function downloadReceiptJPG(reference: string): Promise<string | null> {
  const s = await supabase.auth.getSession();
  const token = s.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const FS = await import('expo-file-system/legacy');
  const path = FS.cacheDirectory + 'gaia-receipt-' + reference.slice(0, 12) + '.jpg';
  const r = await FS.downloadAsync(
    API + '/wallet/receipt/' + reference + '/jpg',
    path,
    { headers: { Authorization: 'Bearer ' + token } },
  );
  if (r.status !== 200) throw new Error('Download failed: ' + r.status);
  return r.uri;
}

export async function downloadReceiptPDF(reference: string): Promise<string | null> {
  const s = await supabase.auth.getSession();
  const token = s.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const FS = await import('expo-file-system/legacy');
  const path = FS.cacheDirectory + 'gaia-receipt-' + reference.slice(0, 12) + '.pdf';
  const r = await FS.downloadAsync(
    API + '/wallet/receipt/' + reference + '/pdf',
    path,
    { headers: { Authorization: 'Bearer ' + token } },
  );
  if (r.status !== 200) throw new Error('Download failed: ' + r.status);
  return r.uri;
}

export async function shareFile(uri: string, mimeType: string = 'application/pdf', title: string = 'GAIA') {
  try {
    const Sharing = await import('expo-sharing');
    const available = await Sharing.isAvailableAsync();
    if (!available) throw new Error('Sharing not available on this device');
    await Sharing.shareAsync(uri, { mimeType: mimeType, dialogTitle: title, UTI: 'com.adobe.pdf' });
    return true;
  } catch (e: any) {
    throw new Error(e?.message || 'Share failed');
  }
}

export interface WalletPrefs {
  language: string;
  theme: string;
  currency: string;
  date_format: string;
  receipt_email: boolean;
  receipt_sms: boolean;
  notify_txn_push: boolean;
  daily_limit_naira: number;
}

export const DEFAULT_PREFS: WalletPrefs = {
  language: 'en',
  theme: 'dark',
  currency: 'NGN',
  date_format: 'DD/MM/YYYY',
  receipt_email: true,
  receipt_sms: true,
  notify_txn_push: true,
  daily_limit_naira: 50000,
};

export async function loadPreferences(): Promise<WalletPrefs> {
  const s = await supabase.auth.getSession();
  const uid = s.data.session?.user?.id;
  if (!uid) return DEFAULT_PREFS;
  try {
    const { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (data) {
      return {
        language: data.language || DEFAULT_PREFS.language,
        theme: data.theme || DEFAULT_PREFS.theme,
        currency: data.currency || DEFAULT_PREFS.currency,
        date_format: data.date_format || DEFAULT_PREFS.date_format,
        receipt_email: data.receipt_email ?? DEFAULT_PREFS.receipt_email,
        receipt_sms: data.receipt_sms ?? DEFAULT_PREFS.receipt_sms,
        notify_txn_push: data.notify_txn_push ?? DEFAULT_PREFS.notify_txn_push,
        daily_limit_naira: Number(data.daily_limit_naira || DEFAULT_PREFS.daily_limit_naira),
      };
    }
  } catch {}
  return DEFAULT_PREFS;
}

export async function savePreferences(prefs: Partial<WalletPrefs>): Promise<void> {
  const s = await supabase.auth.getSession();
  const uid = s.data.session?.user?.id;
  if (!uid) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: uid, ...prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}
