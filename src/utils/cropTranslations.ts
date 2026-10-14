export type Lang = 'en' | 'ha' | 'yo' | 'ig' | 'pcm';

export const CROP_LABELS: Record<string, Record<Lang, string>> = {
  maize:       { en: 'Maize',    ha: 'Masara',   yo: 'Agbado',  ig: 'Ọka',     pcm: 'Maize' },
  rice_6class: { en: 'Rice',     ha: 'Shinkafa', yo: 'Iresi',   ig: 'Osikapa', pcm: 'Rice' },
  pests_102class: { en: 'Pests', ha: 'Kwari',    yo: 'Kokoro',  ig: 'Ahụhụ',   pcm: 'Pests' },
  soil_11class:   { en: 'Soil',  ha: 'Ƙasa',     yo: 'Ilẹ̀',     ig: 'Ala',     pcm: 'Soil' },
  poultry:        { en: 'Poultry', ha: 'Kaji',   yo: 'Adìẹ',    ig: 'Ọkụkọ',   pcm: 'Fowl' },
};

export const UI_LABELS: Record<string, Record<Lang, string>> = {
  start_scan:      { en: 'START SCAN',     ha: 'FARA BINCIKE', yo: 'BẸ̀RẸ̀ ÀYẸ̀WÒ', ig: 'BIDO NYOCHA', pcm: 'START SCAN' },
  stop_scan:       { en: 'STOP & ANALYZE', ha: 'TSAYA',        yo: 'DÚRÓ',        ig: 'KWỤSỊ',       pcm: 'STOP' },
  scan_again:      { en: 'SCAN AGAIN',     ha: 'SAKE BINCIKE', yo: 'TÚN ÀYẸ̀WÒ',  ig: 'NYOCHA ỌZỌ', pcm: 'SCAN AGAIN' },
  verdict:         { en: 'CONSENSUS RESULT', ha: 'SAKAMAKO',   yo: 'ÌPINNÌ',       ig: 'MKPEBI',      pcm: 'RESULT' },
  confidence:      { en: 'CONFIDENCE',     ha: 'TABBACI',      yo: 'ÌGBẸ́KẸ̀LẸ̀',   ig: 'NTOKWASỊ',    pcm: 'CONFIDENCE' },
  severity:        { en: 'SEVERITY',       ha: 'TSANANI',      yo: 'BURÚJẸ',       ig: 'AKA',         pcm: 'HOW BAD' },
  votes:           { en: 'VOTES AGREE',    ha: 'KIYASTA',      yo: 'ÌDÌBÒ',        ig: 'NTỤLI',       pcm: 'VOTES' },
  action_plan:     { en: 'ACTION PLAN',    ha: 'SHIRI',        yo: 'ÈTÒ',          ig: 'ATỤMATỌ',     pcm: 'PLAN' },
  preparing:       { en: 'Preparing your action plan…', ha: 'Ana shirya…', yo: 'Ń ṣètò…', ig: 'Na-akwado…', pcm: 'Dey prepare…' },
  plant_label:     { en: 'PLANTS',         ha: 'TSIRRAI',      yo: 'OHUN ÒGÌN',    ig: 'OSISI',       pcm: 'PLANTS' },
  infected_label:  { en: 'INFECTED',       ha: 'CIUTA',        yo: 'ÀRÙN',         ig: 'ỌRỊA',        pcm: 'SICK' },
  share_whatsapp:  { en: 'SHARE ON WHATSAPP', ha: 'RAI WA',    yo: 'PÍN SÓRI',     ig: 'KERỌ NA',     pcm: 'SEND WA' },
  send_sms:        { en: 'SEND BY SMS',    ha: 'AIKIN SMS',    yo: 'FI SMS RÁNSẸ́', ig: 'ZIPU SMS',    pcm: 'SEND SMS' },
  talk_to_gaia:    { en: 'TALK TO GAIA',   ha: 'YI MAGANA',    yo: 'BÁ MI SỌ̀RỌ̀',  ig: 'GWA M',       pcm: 'TALK TO GAIA' },
  change_alarm:    { en: 'CHANGE DETECTED', ha: 'SAUYI',       yo: 'ÌYÀTỌ̀',        ig: 'MGbanwe',     pcm: 'CHANGE' },
  nearby_alert:    { en: 'NEARBY OUTBREAK', ha: 'KUSA DA KU',  yo: 'NÍBẸ̀',         ig: 'NSO',         pcm: 'NEARBY' },
};

export function t(key: string, lang: Lang = 'en'): string {
  const row = UI_LABELS[key];
  if (!row) return key;
  return row[lang] || row.en;
}

export function cropLabel(cropKey: string, lang: Lang = 'en'): string {
  const row = CROP_LABELS[cropKey];
  if (!row) return cropKey;
  return row[lang] || row.en;
}

export function detectLangFromText(text: string): Lang {
  const s = ' ' + (text || '').toLowerCase() + ' ';
  if (/\b(barka|sannu|nagode|masara|kaji|ƙasa)\b/.test(s)) return 'ha';
  if (/\b(bawo|ese|agbado|iresi|ilẹ̀)\b/.test(s)) return 'yo';
  if (/\b(kedu|daalu|ọka|ahụhụ|ọkụkọ)\b/.test(s)) return 'ig';
  if (/\b(wetin|dey|abeg)\b/.test(s)) return 'pcm';
  return 'en';
}
