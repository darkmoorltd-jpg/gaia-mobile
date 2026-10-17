import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export type Lang = 'yo' | 'ha' | 'ig';
export const LANG_LABELS: Record<Lang, string> = { yo: 'Yoruba', ha: 'Hausa', ig: 'Igbo' };

export async function translateText(text: string, lang: Lang): Promise<string | null> {
  if (!text || text.length < 3) return null;
  try {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return null;
    const label = LANG_LABELS[lang];
    const prompt = 'Translate the following farm produce description into ' + label + '. Reply with ONLY the translation, no quotes, no commentary, no markdown.\n\nText: ' + text;
    const res = await fetch(API_BASE + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ message: prompt, language: lang, history: [] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw: string = data.reply || data.answer || '';
    const clean = raw.replace(/^```[\s\S]*?\n/, '').replace(/```$/g, '').replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, '').trim();
    return clean || null;
  } catch { return null; }
}

export async function saveTranslations(listingId: string, translations: Partial<Record<Lang, string>>): Promise<void> {
  try {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) return;
    const existing = await supabase.from('marketplace_listings').select('translations').eq('id', listingId).maybeSingle();
    const merged = { ...(existing.data?.translations || {}), ...translations };
    await supabase.from('marketplace_listings').update({ translations: merged }).eq('id', listingId);
  } catch {}
}
