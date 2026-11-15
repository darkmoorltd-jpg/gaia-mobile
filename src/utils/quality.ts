import { supabase } from '../api/supabase';

export interface QualityGrade {
  id: string;
  crop_name: string;
  grade_code: string;
  moisture_max_pct: number;
  foreign_matter_max_pct: number;
  broken_grains_max_pct: number;
  aflatoxin_max_ppb: number;
  description: string;
  reference_photo_url: string | null;
}

export async function listGradesForCrop(crop: string): Promise<QualityGrade[]> {
  const { data, error } = await supabase.from('quality_grades').select('*').eq('crop_name', crop);
  if (error || !Array.isArray(data)) return [];
  return data as QualityGrade[];
}

export async function retainSample(batchId: string, location: string, sealedBy: string): Promise<{ ok: boolean; sample_code?: string; error?: string }> {
  const code = 'SAMPLE-' + Date.now().toString(36).toUpperCase();
  const { error } = await supabase.from('batch_samples').insert({
    batch_id: batchId, sample_code: code, location,
    retained_until: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    sealed_by: sealedBy,
  });
  if (error) return { ok: false, error: error.message };
  await supabase.from('batches').update({ sample_retained: true }).eq('id', batchId);
  return { ok: true, sample_code: code };
}

export function gradeIsSafe(grade: QualityGrade, moisture: number, foreignMatter: number): boolean {
  return moisture <= grade.moisture_max_pct && foreignMatter <= grade.foreign_matter_max_pct;
}
