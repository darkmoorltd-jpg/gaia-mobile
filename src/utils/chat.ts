import { supabase } from '../api/supabase';

export interface ChatMessage {
  id: number;
  room_id?: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string | null;
  read_at?: string | null;
  created_at: string;
}

/**
 * Fetch the full DM conversation between two users.
 * Matches the backend `messages` table.
 */
export async function fetchMessages(me: string, peer: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      'and(sender_id.eq.' + me + ',receiver_id.eq.' + peer + '),' +
      'and(sender_id.eq.' + peer + ',receiver_id.eq.' + me + ')'
    )
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) {
    console.warn('fetchMessages error:', error.message);
    return [];
  }
  return (data || []) as ChatMessage[];
}

/**
 * Send a text or image message.
 * Returns { data, error } matching chat-room.tsx expectations.
 */
export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string,
  imageUrl: string | null = null,
): Promise<{ data: ChatMessage | null; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      image_url: imageUrl,
      room_id: 'dm',
    })
    .select()
    .single();
  return { data: (data as ChatMessage) || null, error: error?.message || null };
}

/**
 * Mark all messages from `peer` to `me` as read.
 */
export async function markMessagesRead(me: string, peer: string) {
  try {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', peer)
      .eq('receiver_id', me)
      .is('read_at', null);
  } catch (e) {
    console.warn('markMessagesRead error:', e);
  }
}

/**
 * Subscribe to incoming DMs for the current user.
 * Returns an unsubscribe function.
 */
export function subscribeToIncoming(
  me: string,
  onNew: (m: ChatMessage) => void,
): () => void {
  const channel = supabase
    .channel('dm-' + me + '-' + Date.now())
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'receiver_id=eq.' + me,
      },
      (payload: any) => {
        const record = payload.new || payload.record;
        if (record) onNew(record as ChatMessage);
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/**
 * Broadcast that I'm typing to `peer`.
 * Uses the backend `typing_status` table.
 */
export async function setTyping(me: string, peer: string) {
  try {
    await supabase.from('typing_status').upsert({
      user_id: me,
      peer_id: peer,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('setTyping error:', e);
  }
}

/**
 * Subscribe to typing events from `peer` directed at `me`.
 */
export function subscribeToTyping(
  me: string,
  peer: string,
  onTyping: () => void,
): () => void {
  const channel = supabase
    .channel('typing-' + me + '-' + peer + '-' + Date.now())
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'typing_status',
        filter: 'peer_id=eq.' + me,
      },
      (payload: any) => {
        const record = payload.new || payload.record;
        if (record && record.user_id === peer) onTyping();
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/**
 * HH:MM format from ISO timestamp.
 */
export function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return (
      d.getHours().toString().padStart(2, '0') +
      ':' +
      d.getMinutes().toString().padStart(2, '0')
    );
  } catch {
    return '';
  }
}

/**
 * Day label — Today / Yesterday / date.
 */
export function fmtDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString();
}
