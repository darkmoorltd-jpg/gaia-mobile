import { supabase } from '../api/supabase';

export interface ChatMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: string;
  media_url?: string;
  delivered_at?: string;
  read_at?: string;
  deleted?: boolean;
  created_at: string;
}

export async function fetchMessages(me: string, peer: string): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .or(
      'and(sender_id.eq.' + me + ',receiver_id.eq.' + peer + '),' +
      'and(sender_id.eq.' + peer + ',receiver_id.eq.' + me + ')'
    )
    .order('created_at', { ascending: true })
    .limit(300);
  return (data || []) as ChatMessage[];
}

export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string,
  type: string = 'text',
  mediaUrl: string | null = null,
) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content, type, media_url: mediaUrl })
    .select()
    .single();
  return { data, error: error?.message || null };
}

export async function markMessagesRead(me: string, peer: string) {
  try {
    await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', peer)
      .eq('receiver_id', me)
      .is('read_at', null);
  } catch {}
}

export async function deleteMessage(id: number) {
  await supabase.from('chat_messages').update({ deleted: true }).eq('id', id);
}

export function subscribeToIncoming(me: string, onNew: (m: ChatMessage) => void) {
  const channel = supabase
    .channel('dm-' + me + '-' + Date.now())
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'receiver_id=eq.' + me },
      (payload: any) => onNew(payload.new as ChatMessage),
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function setTyping(me: string, peer: string) {
  try {
    await supabase.from('chat_typing').upsert({
      user_id: me,
      peer_id: peer,
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

export function subscribeToTyping(me: string, peer: string, onTyping: () => void) {
  const channel = supabase
    .channel('typing-' + me + '-' + peer)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_typing', filter: 'peer_id=eq.' + me },
      (payload: any) => {
        if (payload.new && payload.new.user_id === peer) onTyping();
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  } catch { return ''; }
}

export function fmtDayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString();
}
