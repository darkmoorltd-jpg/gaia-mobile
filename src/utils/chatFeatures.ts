import { supabase } from '../api/supabase';

// ---------- STARRED ----------
export async function starMessage(userId: string, messageId: number): Promise<string | null> {
  const { error } = await supabase.from('chat_starred').insert({
    user_id: userId, message_id: messageId,
  });
  return error ? error.message : null;
}

export async function unstarMessage(userId: string, messageId: number): Promise<string | null> {
  const { error } = await supabase.from('chat_starred')
    .delete()
    .eq('user_id', userId)
    .eq('message_id', messageId);
  return error ? error.message : null;
}

export async function isStarred(userId: string, messageId: number): Promise<boolean> {
  const { data } = await supabase.from('chat_starred')
    .select('message_id')
    .eq('user_id', userId)
    .eq('message_id', messageId)
    .maybeSingle();
  return !!data;
}

export async function listStarredIds(userId: string): Promise<number[]> {
  const { data } = await supabase.from('chat_starred')
    .select('message_id')
    .eq('user_id', userId);
  return (data || []).map((r: any) => r.message_id);
}

export async function listStarredMessages(userId: string): Promise<any[]> {
  const ids = await listStarredIds(userId);
  if (ids.length === 0) return [];
  const { data } = await supabase.from('chat_messages')
    .select('id,body,created_at,sender_id,attachment_url,attachment_type,room_id')
    .in('id', ids)
    .order('created_at', { ascending: false });
  return data || [];
}

// ---------- FORWARD ----------
export async function forwardMessage(
  fromUserId: string,
  toUserId: string,
  body: string,
  attachmentUrl: string | null,
  attachmentType: string | null,
): Promise<string | null> {
  try {
    // Find or create a DM room between fromUserId and toUserId
    const { data: rid, error: rpcErr } = await supabase.rpc('get_or_create_dm', {
      other_user_id: toUserId,
    });
    if (rpcErr || !rid) return rpcErr ? rpcErr.message : 'no room';
    const roomId = rid as unknown as string;
    const { error } = await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_id: fromUserId,
      body,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
      forwarded: true,
    });
    return error ? error.message : null;
  } catch (e: any) {
    return e && e.message ? e.message : 'forward failed';
  }
}

// ---------- REPLY ----------
// Reply is client-side: we store the target message id, then include it
// in the next insert via reply_to_id.

export function replyPreview(msg: any): string {
  if (!msg) return '';
  if (msg.attachment_url) {
    return msg.attachment_type === 'image' ? '[Image]' : '[File]';
  }
  const t = String(msg.body || '');
  return t.length > 60 ? t.slice(0, 60) + '…' : t;
}

// ---------- FORWARD CONTACT PICKER DATA ----------
export async function listForwardTargets(userId: string): Promise<any[]> {
  const { data: fships } = await supabase
    .from('friendships')
    .select('sender_id,receiver_id')
    .eq('status', 'accepted');
  const mine = (fships || []).filter(
    (r: any) => r.sender_id === userId || r.receiver_id === userId,
  );
  const ids = mine.map((r: any) =>
    r.sender_id === userId ? r.receiver_id : r.sender_id,
  );
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id,first_name,last_name,email,avatar_url')
    .in('user_id', ids);
  return (profiles || []).map((p: any) => ({
    user_id: p.user_id,
    name: ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || (p.email ? p.email.split('@')[0] : 'Farmer'),
    avatar_url: p.avatar_url,
    email: p.email,
  }));
}
