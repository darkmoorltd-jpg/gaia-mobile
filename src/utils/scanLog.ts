import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../api/supabase';

export type ScanType = 'crops' | 'pests' | 'soil' | 'livestock' | 'video';
export type ScanOutcome = 'improved' | 'worsened' | 'resolved' | 'pending';

export interface ScanPayload {
  type: ScanType;
  model_key: string;
  top_label: string;
  confidence: number;
  all_predictions: Array<{ label: string; confidence: number }>;
  image_uri?: string | null;
  gps_lat?: number | null;
  gps_lon?: number | null;
  farm_id?: string | null;
  plot_name?: string | null;
  on_device?: boolean;
  inference_ms?: number;
  follow_up_of?: string | null;
  treatment_applied?: any;
}

async function uploadImage(uri: string, userId: string): Promise<string | null> {
  try {
    // fetch(uri).blob() works with file:// URIs on React Native
    // (ArrayBuffer / Uint8Array.buffer does NOT — Supabase JS v2 requires Blob)
    const response = await fetch(uri);
    if (!response.ok && response.status !== 0) {
      console.warn('[scanLog] fetch uri failed', response.status);
    }
    const blob = await response.blob();
    const path = userId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
    const { error } = await supabase.storage
      .from('scan-images')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      console.warn('[scanLog] upload failed', error.message);
      return null;
    }
    return supabase.storage.from('scan-images').getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn('[scanLog] upload exception', e);
    return null;
  }
}

export async function logScan(payload: ScanPayload): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let imageUrl: string | null = null;
    if (payload.image_uri) {
      imageUrl = await uploadImage(payload.image_uri, user.id);
    }

    const { data, error } = await supabase
      .from('scan_history')
      .insert({
        user_id: user.id,
        type: payload.type,
        model_key: payload.model_key,
        top_label: payload.top_label,
        confidence: payload.confidence,
        all_predictions: payload.all_predictions || [],
        image_url: imageUrl,
        gps_lat: payload.gps_lat ?? null,
        gps_lon: payload.gps_lon ?? null,
        farm_id: payload.farm_id ?? null,
        plot_name: payload.plot_name ?? null,
        on_device: payload.on_device ?? false,
        inference_ms: payload.inference_ms ?? null,
        follow_up_of: payload.follow_up_of ?? null,
        treatment_applied: payload.treatment_applied ?? null,
        recommendation: payload.recommendation ?? null,
        outcome: payload.follow_up_of ? 'pending' : null,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[scanLog] insert failed', error.message);
      return null;
    }
    return data?.id || null;
  } catch (e) {
    console.warn('[scanLog] exception', e);
    return null;
  }
}

export async function markScanOutcome(
  scanId: string,
  outcome: ScanOutcome,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('scan_history')
      .update({ outcome })
      .eq('id', scanId);
    return !error;
  } catch {
    return false;
  }
}

export async function logTreatment(scanId: string, treatment: any): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('scan_history')
      .update({ treatment_applied: treatment })
      .eq('id', scanId);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteScan(scanId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('scan_history').delete().eq('id', scanId);
    return !error;
  } catch {
    return false;
  }
}
