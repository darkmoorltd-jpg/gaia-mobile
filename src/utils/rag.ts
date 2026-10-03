import * as FileSystem from 'expo-file-system';
import { supabase } from '../api/supabase';

const API_BASE = 'https://gaia-api.onrender.com';


export interface Document {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  chunk_count: number;
  created_at: string;
}


export async function uploadDocument(
  uri: string,
  name: string,
  mimeType: string,
): Promise<{ doc: Document | null; error: string | null }> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const userId = session.data.session?.user?.id;
    if (!token || !userId) return { doc: null, error: 'Not signed in' };

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const cleanName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = userId + '/' + Date.now() + '-' + cleanName;
    const arrayBuffer = decode(base64);

    const { error: storageError } = await supabase.storage
      .from('knowledge-base')
      .upload(storagePath, arrayBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (storageError) return { doc: null, error: storageError.message };

    const { data: urlData } = supabase.storage
      .from('knowledge-base')
      .getPublicUrl(storagePath);

    const result = await FileSystem.uploadAsync(
      API_BASE + '/rag/upload',
      uri,
      {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: mimeType,
        headers: { Authorization: 'Bearer ' + token },
        parameters: { file_url: urlData.publicUrl },
      },
    );

    if (result.status !== 200 && result.status !== 201) {
      return {
        doc: null,
        error: 'Processing failed: ' + result.status,
      };
    }

    const doc = JSON.parse(result.body);
    return { doc, error: null };
  } catch (e: any) {
    return { doc: null, error: e?.message ?? 'Upload failed' };
  }
}


function decode(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}


export async function listDocuments(): Promise<Document[]> {
  const session = await supabase.auth.getSession();
  const uid = session.data.session?.user?.id;
  if (!uid) return [];

  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  return data ?? [];
}


export async function deleteDocument(id: string): Promise<boolean> {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  return !error;
}


export async function askRag(question: string, language: string): Promise<string> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not signed in');

  const res = await fetch(API_BASE + '/rag/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({ question, language }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('RAG query failed: ' + res.status + ' ' + errText.slice(0, 100));
  }

  const data = await res.json();
  return data.answer || '';
}
