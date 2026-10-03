import { supabase } from '../api/supabase';

export interface UserProfile {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  state?: string;
  crop?: string;
}

export async function ensureMyProfile(userId: string, email: string) {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) {
      await supabase.from('user_profiles').insert({
        user_id: userId,
        email: email.toLowerCase(),
      });
    }
  } catch {}
}

export async function searchUserByEmail(email: string): Promise<UserProfile[]> {
  const q = email.trim().toLowerCase();
  if (q.length < 3) return [];
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id,email,first_name,last_name,avatar_url,state,crop')
    .ilike('email', '%' + q + '%')
    .limit(10);
  return (data || []) as UserProfile[];
}

export async function sendFriendRequest(senderId: string, receiverId: string) {
  const { error } = await supabase
    .from('friendships')
    .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' });
  return error?.message || null;
}

export async function acceptFriendRequest(id: number) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id);
  return error?.message || null;
}

export async function rejectFriendRequest(id: number) {
  const { error } = await supabase.from('friendships').delete().eq('id', id);
  return error?.message || null;
}

export async function listFriends(userId: string): Promise<UserProfile[]> {
  const { data } = await supabase
    .from('friendships')
    .select('*')
    .eq('status', 'accepted')
    .or('sender_id.eq.' + userId + ',receiver_id.eq.' + userId);
  if (!data || data.length === 0) return [];
  const ids = data.map((f: any) => (f.sender_id === userId ? f.receiver_id : f.sender_id));
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id,email,first_name,last_name,avatar_url,state,crop')
    .in('user_id', ids);
  return (profiles || []) as UserProfile[];
}

export async function listPendingRequests(userId: string) {
  const { data } = await supabase
    .from('friendships')
    .select('*')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (!data || data.length === 0) return [];
  const ids = data.map((f: any) => f.sender_id);
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id,email,first_name,last_name,avatar_url')
    .in('user_id', ids);
  const map: any = {};
  (profiles || []).forEach((p: any) => { map[p.user_id] = p; });
  return data.map((f: any) => ({ ...f, sender: map[f.sender_id] || {} }));
}

export function displayName(p: UserProfile) {
  const n = ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
  return n || (p.email ? p.email.split('@')[0] : 'Farmer');
}


// ============================================================
//  BLOCKING
// ============================================================
export async function blockUser(blockerId: string, blockedId: string): Promise<string | null> {
  const { error } = await supabase
    .from('user_blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  return error?.message || null;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<string | null> {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  return error?.message || null;
}

export async function listBlockedIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_blocks')
    .select('blocker_id,blocked_id')
    .or('blocker_id.eq.' + userId + ',blocked_id.eq.' + userId);
  if (!data) return [];
  const set = new Set<string>();
  for (const r of data as any[]) {
    if (r.blocker_id === userId) set.add(r.blocked_id);
    else set.add(r.blocker_id);
  }
  return Array.from(set);
}

export async function listBlockedUsers(userId: string) {
  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_id,created_at')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });
  if (!data || data.length === 0) return [];
  const ids = data.map((r: any) => r.blocked_id);
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id,email,first_name,last_name,avatar_url')
    .in('user_id', ids);
  const map: any = {};
  (profiles || []).forEach((p: any) => { map[p.user_id] = p; });
  return data.map((r: any) => ({ ...r, profile: map[r.blocked_id] || {} }));
}

export type BlockState = 'none' | 'blocked_by_me' | 'blocked_by_them';

export async function getBlockState(me: string, other: string): Promise<BlockState> {
  const { data } = await supabase
    .from('user_blocks')
    .select('blocker_id,blocked_id')
    .or(
      'and(blocker_id.eq.' + me + ',blocked_id.eq.' + other + '),' +
      'and(blocker_id.eq.' + other + ',blocked_id.eq.' + me + ')'
    );
  if (!data || data.length === 0) return 'none';
  for (const r of data as any[]) {
    return r.blocker_id === me ? 'blocked_by_me' : 'blocked_by_them';
  }
  return 'none';
}

// ============================================================
//  DELETE CHAT (hide from my list only)
// ============================================================
export async function hideConversation(userId: string, otherUserId: string): Promise<string | null> {
  const { error } = await supabase
    .from('chat_hides')
    .upsert({
      user_id: userId,
      other_user_id: otherUserId,
      hidden_at: new Date().toISOString(),
    });
  return error?.message || null;
}

export async function listHiddenIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('chat_hides')
    .select('other_user_id')
    .eq('user_id', userId);
  return (data || []).map((r: any) => r.other_user_id);
}
