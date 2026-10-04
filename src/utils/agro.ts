import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export type AgroTool = 'yield' | 'fertilizer' | 'profit' | 'calendar' | 'seed';

export interface AgroRequest {
  tool: AgroTool;
  crop: string;
  state: string;
  hectares?: number;
  budget_naira?: number;
  growth_stage?: string;
  planting_month?: string;
  notes?: string;
}

export const NIGERIAN_CROPS = [
  'Maize', 'Rice', 'Sorghum', 'Millet', 'Wheat', 'Fonio',
  'Cassava', 'Yam', 'Sweet Potato', 'Irish Potato', 'Cocoyam',
  'Cowpea (Beans)', 'Soybean', 'Groundnut', 'Sesame', 'Pigeon Pea',
  'Tomato', 'Pepper', 'Onion', 'Cabbage', 'Okra', 'Cucumber',
  'Oil Palm', 'Cocoa', 'Kola Nut', 'Rubber',
  'Cotton', 'Ginger', 'Turmeric',
];

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti',
  'Enugu', 'FCT Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
];

export const GROWTH_STAGES = [
  'Pre-planting', 'Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Maturity',
];

export const PLANTING_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function runAgroTool(req: AgroRequest): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const sess = await supabase.auth.getSession();
    const token = sess.data.session?.access_token;
    const res = await fetch(API_BASE + '/agro-tools', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: 'Server ' + res.status + ': ' + txt.slice(0, 200) };
    }
    const json = await res.json();
    return { ok: true, data: json.data };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}
