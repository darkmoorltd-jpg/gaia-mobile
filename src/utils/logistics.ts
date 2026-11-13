import { supabase } from '../api/supabase';

export const API_BASE = 'https://gaia-api-xuly.onrender.com';

async function authHdr() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface CreateBatchPayload {
  crop_name: string;
  quantity_kg: number;
  quality_grade: string;
  location: string;
  harvest_date?: string;
  moisture_pct?: number;
  notes?: string;
}

export async function apiCreateBatch(payload: CreateBatchPayload) {
  const headers = await authHdr();
  const res = await fetch(`${API_BASE}/logistics/batches`, {
    method: 'POST', headers, body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiDispatch(batchCode: string) {
  const headers = await authHdr();
  const res = await fetch(`${API_BASE}/logistics/${batchCode}/dispatch`, {
    method: 'POST', headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiReceive(batchCode: string, received_kg: number, loss_reason?: string) {
  const headers = await authHdr();
  const res = await fetch(`${API_BASE}/logistics/${batchCode}/receive`, {
    method: 'POST', headers,
    body: JSON.stringify({ received_kg, loss_reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiDeliver(batchCode: string) {
  const headers = await authHdr();
  const res = await fetch(`${API_BASE}/logistics/${batchCode}/deliver`, {
    method: 'POST', headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export function eudrPdfUrl(batchCode: string): string {
  return `${API_BASE}/logistics/eudr/${batchCode}/pdf`;
}
