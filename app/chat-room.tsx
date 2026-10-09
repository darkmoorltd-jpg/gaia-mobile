import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert,
  Linking, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync, createAudioPlayer } from 'expo-audio';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const SUPABASE_URL = 'https://pxvtvuwlpzwlkdoxjrep.supabase.co';
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Msg {
  id: number | string;
  sender_id: string;
  body: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  reply_to_id?: string | null;
  forwarded?: boolean;
  edited_at?: string | null;
  deleted_for_everyone?: boolean;
}

function timeOf(iso: string) {
  try {
    const d = new Date(iso);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return h + ':' + m;
  } catch { return ''; }
}

function dayLabel(iso: string) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yest = new Date(Date.now() - 86400000);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (same(d, today)) return 'TODAY';
    if (same(d, yest)) return 'YESTERDAY';
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  } catch { return ''; }
}

export default function ChatRoom() {
  const router = useRouter();
  const { uid, room, group } = useLocalSearchParams<{ uid?: string; room?: string; group?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('Chat');
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [isGroup, setIsGroup] = useState<boolean>(false);
  const [memberCount, setMemberCount] = useState(0);
  const [groupName, setGroupName] = useState('');
  const [memberMap, setMemberMap] = useState<Record<string, string>>({});
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Record<string, any[]>>({});
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [menuFor, setMenuFor] = useState<Msg | null>(null);
  const [reactFor, setReactFor] = useState<Msg | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [playingId, setPlayingId] = useState<string | number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [editing, setEditing] = useState<Msg | null>(null);
  const [editText, setEditText] = useState('');
  const [forwardFor, setForwardFor] = useState<Msg | null>(null);
  const [forwardList, setForwardList] = useState<any[]>([]);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList<Msg>>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingTimer = useRef<any>(null);
  const ringtoneRef = useRef<any>(null);
  const activePlayer = useRef<any>(null);
  const typingTimer = useRef<any>(null);
  const lastTypingWrite = useRef<number>(0);

  const markRead = useCallback(async (rid: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    await supabase.from('chat_members').update({ last_read_at: now }).eq('room_id', rid).eq('user_id', user.id);
    await supabase.from('chat_messages').update({ read_at: now, delivered_at: now })
      .eq('room_id', rid).neq('sender_id', user.id).is('read_at', null);
  }, [user]);

  const loadReactions = useCallback(async (rid: string) => {
    const { data } = await supabase.from('message_reactions').select('message_id,user_id,emoji').eq('room_id', rid);
    const map: Record<string, any[]> = {};
    (data || []).forEach((r: any) => {
      if (!map[r.message_id]) map[r.message_id] = [];
      map[r.message_id].push(r);
    });
    setReactions(map);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    if (!uid && !room) return;
    setBusy(true);
    try {
      // GROUP MODE
      if (group === '1' && room) {
        setIsGroup(true);
        const rid = room as string;
        setRoomId(rid);

        const { data: roomRow } = await supabase.from('chat_rooms').select('name,avatar_url').eq('id', rid).maybeSingle();
        if (roomRow) {
          setGroupName(roomRow.name || 'Group');
          setOtherName(roomRow.name || 'Group');
          if (roomRow.avatar_url) setOtherAvatar(roomRow.avatar_url);
        }

        const membersRes = await supabase.rpc('list_group_members', { p_room_id: rid });
        const members = membersRes.data || [];
        setMemberCount(members.length);
        const mmap: Record<string, string> = {};
        members.forEach((m: any) => {
          const nm = ((m.first_name || '') + ' ' + (m.last_name || '')).trim() || (m.email ? m.email.split('@')[0] : 'Member');
          mmap[m.user_id] = nm;
        });
        setMemberMap(mmap);

        const { data: msgs } = await supabase.from('chat_messages')
          .select('id,sender_id,body,created_at,attachment_url,attachment_type,delivered_at,read_at,reply_to_id,forwarded,edited_at,deleted_for_everyone,duration_ms')
          .eq('room_id', rid).order('created_at', { ascending: true }).limit(300);
        setMessages((msgs || []) as Msg[]);
        await loadReactions(rid);
        await markRead(rid);
        setBusy(false);
        return;
      }

      // 1:1 MODE (existing)
      if (!uid) return;
      const { data: prof } = await supabase
        .from('user_profiles').select('email,first_name,last_name,avatar_url')
        .eq('user_id', uid).maybeSingle();
      if (prof) {
        const n = ((prof.first_name || '') + ' ' + (prof.last_name || '')).trim();
        setOtherName(n || (prof.email ? prof.email.split('@')[0] : 'Chat'));
        setOtherAvatar(prof.avatar_url || null);
      }

      const { data: rid, error: ridErr } = await supabase.rpc('get_or_create_dm', { other_user_id: uid });
      if (ridErr || !rid) throw ridErr || new Error('no room');
      const roomIdValue = rid as unknown as string;
      setRoomId(roomIdValue);

      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('id,sender_id,body,created_at,attachment_url,attachment_type,delivered_at,read_at,reply_to_id,forwarded,edited_at,deleted_for_everyone')
        .eq('room_id', roomIdValue)
        .order('created_at', { ascending: true })
        .limit(300);
      setMessages((msgs || []) as Msg[]);
      await loadReactions(roomIdValue);

      const starRes = await supabase.from('chat_stars').select('message_id').eq('user_id', user.id);
      const starSet = new Set<string>((starRes.data || []).map((s: any) => String(s.message_id)));
      setStarred(starSet);
      await markRead(roomIdValue);

      const { data: presence } = await supabase.from('user_presence').select('last_seen').eq('user_id', uid).maybeSingle();
      if (presence && presence.last_seen) {
        setOtherOnline(Date.now() - new Date(presence.last_seen).getTime() < 120000);
      }
    } catch (e) {
      console.log('room load error', e);
    } finally {
      setBusy(false);
    }
  }, [user, uid, markRead, loadReactions]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!roomId || !user) return;
    const channel = supabase
      .channel('room-' + roomId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: 'room_id=eq.' + roomId }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user.id) markRead(roomId);
        } else if (payload.eventType === 'UPDATE') {
          const u = payload.new as Msg;
          setMessages((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...u } : x)));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: 'room_id=eq.' + roomId }, () => { loadReactions(roomId); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_typing', filter: 'room_id=eq.' + roomId }, (payload) => {
        const r: any = payload.new || payload.old;
        if (r && r.user_id === uid) {
          const ts = new Date(r.updated_at || Date.now()).getTime();
          setOtherTyping(Date.now() - ts < 5000);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_call_signals', filter: 'callee_id=eq.' + user.id }, (payload) => {
        const sig: any = payload.new;
        if (sig && sig.status === 'ringing' && sig.room_id === roomId) {
          setIncomingCall(sig);
        }
      })
      .subscribe();
    useEffect(() => {
    const startRing = async () => {
      try {
        if (ringtoneRef.current) return;
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        const player = createAudioPlayer({ uri: 'https://actions.google.com/sounds/v1/alarms/phone_ringing_loop.ogg' });
        ringtoneRef.current = player;
        try { (player as any).loop = true; } catch {}
        player.play();
      } catch (e) { console.log('ringtone start', e); }
    };
    const stopRing = () => {
      try { if (ringtoneRef.current) { ringtoneRef.current.remove(); ringtoneRef.current = null; } } catch {}
    };
    if (incomingCall) { startRing(); } else { stopRing(); }
    return () => { stopRing(); };
  }, [incomingCall]);

  const startCall = async (callMode: 'voice' | 'video') => {
    if (!roomId || !user || !uid) return;
    try {
      const jitsiRoom = 'gaia-' + roomId;
      const { data, error } = await supabase.from('chat_call_signals').insert({
        room_id: roomId,
        caller_id: user.id,
        callee_id: uid,
        mode: callMode,
        status: 'ringing',
        jitsi_room: jitsiRoom,
      }).select('id').single();
      if (error) throw error;
      const sigId = data ? data.id : null;
      router.push(('/call?room=' + roomId + '&peer=' + uid + '&name=' + encodeURIComponent(otherName) + '&mode=' + callMode + (sigId ? '&signal=' + sigId : '')) as any);
    } catch (e: any) {
      Alert.alert('Call failed', e && e.message ? e.message : 'Try again');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    const sig = incomingCall;
    setIncomingCall(null);
    try {
      await supabase.from('chat_call_signals').update({ status: 'accepted', answered_at: new Date().toISOString() }).eq('id', sig.id);
    } catch {}
    const peerNameEnc = encodeURIComponent(otherName);
    router.push(('/call?room=' + sig.room_id + '&peer=' + sig.caller_id + '&name=' + peerNameEnc + '&mode=' + sig.mode + '&signal=' + sig.id) as any);
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    const sig = incomingCall;
    setIncomingCall(null);
    try {
      await supabase.from('chat_call_signals').update({ status: 'rejected', ended_at: new Date().toISOString() }).eq('id', sig.id);
    } catch {}
  };

  return () => { supabase.removeChannel(channel); };
  }, [roomId, user, uid, markRead, loadReactions]);

  const bumpTyping = () => {
    if (!roomId || !user) return;
    const now = Date.now();
    if (now - lastTypingWrite.current < 3000) return;
    lastTypingWrite.current = now;
    supabase.from('chat_typing').upsert({ room_id: roomId, user_id: user.id, updated_at: new Date().toISOString() }).then(() => {});
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      supabase.from('chat_typing').upsert({ room_id: roomId, user_id: user.id, updated_at: new Date(0).toISOString() }).then(() => {});
    }, 4000);
  };

  const sendText = async () => {
    const body = text.trim();
    if (!body || !roomId || !user) return;
    setText('');
    setSending(true);
    try {
      const row: any = { room_id: roomId, sender_id: user.id, body };
      if (replyTo) row.reply_to_id = String(replyTo.id);
      await supabase.from('chat_messages').insert(row);
      setReplyTo(null);
    } catch (e) { console.log('send error', e); }
    finally { setSending(false); }
  };

  const uploadAndSend = async (uri: string, name: string, mime: string, type: 'image' | 'file') => {
    if (!roomId || !user) return;
    setUploading(true);
    try {
      const sess = await supabase.auth.getSession();
      const tok = sess.data.session ? sess.data.session.access_token : null;
      if (!tok) throw new Error('no session');
      const ext = (name.split('.').pop() || 'bin').toLowerCase();
      const path = roomId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const upUrl = SUPABASE_URL + '/storage/v1/object/chat-attachments/' + path;
      const r = await FileSystem.uploadAsync(upUrl, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { Authorization: 'Bearer ' + tok, 'Content-Type': mime, 'x-upsert': 'false' },
      });
      if (r.status < 200 || r.status >= 300) throw new Error('upload ' + r.status);
      const pub = SUPABASE_URL + '/storage/v1/object/public/chat-attachments/' + path;
      const row: any = { room_id: roomId, sender_id: user.id, body: name, attachment_url: pub, attachment_type: type };
      if (replyTo) row.reply_to_id = String(replyTo.id);
      await supabase.from('chat_messages').insert(row);
      setReplyTo(null);
    } catch (e) { Alert.alert('Upload failed', e && e.message ? e.message : 'Try again'); }
    finally { setUploading(false); }
  };

  const startVoice = async () => {
    if (!roomId || !user) return;
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('Microphone permission required'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecordingMs(0);
      const started = Date.now();
      recordingTimer.current = setInterval(() => { setRecordingMs(Date.now() - started); }, 100);
    } catch (e: any) {
      Alert.alert('Recording error', e && e.message ? e.message : 'Try again');
      setIsRecording(false);
    }
  };

  const stopVoiceAndSend = async (send: boolean) => {
    if (recordingTimer.current) { clearInterval(recordingTimer.current); recordingTimer.current = null; }
    setIsRecording(false);
    const durationMs = recordingMs;
    setRecordingMs(0);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      if (!send || !uri) return;
      if (durationMs < 800) { Alert.alert('Too short', 'Hold longer to record a voice note.'); return; }
      await uploadVoice(uri, durationMs);
    } catch (e: any) {
      Alert.alert('Stop error', e && e.message ? e.message : 'Try again');
    }
  };

  const uploadVoice = async (uri: string, durationMs: number) => {
    if (!roomId || !user) return;
    setUploading(true);
    try {
      const sess = await supabase.auth.getSession();
      const tok = sess.data.session ? sess.data.session.access_token : null;
      if (!tok) throw new Error('no session');
      const path = roomId + '/voice_' + Date.now() + '.m4a';
      const upUrl = SUPABASE_URL + '/storage/v1/object/chat-attachments/' + path;
      const r = await FileSystem.uploadAsync(upUrl, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'audio/m4a', 'x-upsert': 'false' },
      });
      if (r.status < 200 || r.status >= 300) throw new Error('upload ' + r.status);
      const pub = SUPABASE_URL + '/storage/v1/object/public/chat-attachments/' + path;
      const row: any = {
        room_id: roomId,
        sender_id: user.id,
        body: 'Voice note',
        attachment_url: pub,
        attachment_type: 'audio',
        duration_ms: durationMs,
      };
      if (replyTo) row.reply_to_id = String(replyTo.id);
      await supabase.from('chat_messages').insert(row);
      setReplyTo(null);
    } catch (e: any) {
      Alert.alert('Voice upload failed', e && e.message ? e.message : 'Try again');
    } finally {
      setUploading(false);
    }
  };

  const playVoice = async (m: Msg) => {
    try {
      if (activePlayer.current) {
        try { activePlayer.current.remove(); } catch {}
        activePlayer.current = null;
      }
      if (playingId === m.id) { setPlayingId(null); return; }
      if (!m.attachment_url) return;
      setPlayingId(m.id);
      const player = createAudioPlayer({ uri: m.attachment_url });
      activePlayer.current = player;
      try {
        const sub = (player as any).addListener('playbackStatusUpdate', (st: any) => {
          if (st && st.didJustFinish) { sub.remove(); setPlayingId(null); try { player.remove(); } catch {} }
        });
        player.play();
        setTimeout(() => { setPlayingId(null); }, (m.duration_ms || 30000) + 2000);
      } catch { setPlayingId(null); }
    } catch (e) {
      setPlayingId(null);
    }
  };

  const fmtDuration = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + (r < 10 ? '0' + r : String(r));
  };

  const pickImage = async (from: 'camera' | 'library') => {
    setAttachOpen(false);
    try {
      let res: any;
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Camera permission required'); return; }
        res = await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: false });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Photo permission required'); return; }
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75, allowsEditing: false });
      }
      if (res.canceled) return;
      const a = res.assets[0];
      await uploadAndSend(a.uri, a.fileName || 'photo.jpg', a.mimeType || 'image/jpeg', 'image');
    } catch (e) { console.log('pick error', e); }
  };

  const pickFile = async () => {
    setAttachOpen(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const a = res.assets[0];
      await uploadAndSend(a.uri, a.name || 'document', a.mimeType || 'application/octet-stream', 'file');
    } catch (e) { console.log('file error', e); }
  };

  const shareLocation = async () => {
    setAttachOpen(false);
    if (!roomId || !user) return;
    Alert.alert('Share location', 'Opens your map app to pick a point? For now we share a marker.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Share', onPress: async () => {
        const body = 'Location: 9.0820, 8.6753 (Abuja, NG)';
        await supabase.from('chat_messages').insert({ room_id: roomId, sender_id: user.id, body, attachment_type: 'location' });
      }},
    ]);
  };

  const copyMsg = async (m: Msg) => {
    setMenuFor(null);
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(m.body || '');
      Alert.alert('Copied');
    } catch {}
  };

  const deleteForMe = async (m: Msg) => {
    setMenuFor(null);
    if (!user) return;
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
  };

  const deleteForEveryone = async (m: Msg) => {
    setMenuFor(null);
    if (!user) return;
    Alert.alert('Delete for everyone?', 'This will remove the message for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('chat_messages').update({ deleted_for_everyone: true, body: '' }).eq('id', m.id);
      }},
    ]);
  };

  const react = async (m: Msg, emoji: string) => {
    setReactFor(null);
    setMenuFor(null);
    if (!roomId || !user) return;
    const existing = (reactions[String(m.id)] || []).find((r: any) => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('message_reactions').delete().eq('message_id', String(m.id)).eq('user_id', user.id).eq('emoji', emoji);
    } else {
      await supabase.from('message_reactions').insert({ message_id: String(m.id), room_id: roomId, user_id: user.id, emoji });
    }
  };

  const toggleStar = async (m: Msg) => {
    setMenuFor(null);
    if (!user || !roomId) return;
    const mid = String(m.id);
    const isStarred = starred.has(mid);
    if (isStarred) {
      await supabase.from('chat_stars').delete().eq('user_id', user.id).eq('message_id', mid);
      setStarred((prev) => { const n = new Set(prev); n.delete(mid); return n; });
    } else {
      await supabase.from('chat_stars').insert({ user_id: user.id, message_id: mid, room_id: roomId });
      setStarred((prev) => { const n = new Set(prev); n.add(mid); return n; });
    }
  };

  const openEdit = (m: Msg) => {
    setMenuFor(null);
    setEditing(m);
    setEditText(m.body || '');
  };

  const saveEdit = async () => {
    if (!editing || !user) return;
    const trimmed = editText.trim();
    if (!trimmed) { setEditing(null); return; }
    const { error } = await supabase.from('chat_messages')
      .update({ body: trimmed, edited_at: new Date().toISOString() })
      .eq('id', editing.id).eq('sender_id', user.id);
    setEditing(null);
    if (error) Alert.alert('Edit failed', error.message);
  };

  const openForward = async (m: Msg) => {
    setMenuFor(null);
    if (!user) return;
    const { data: fships } = await supabase.from('friendships').select('sender_id,receiver_id').eq('status', 'accepted');
    const mine = (fships || []).filter((r: any) => r.sender_id === user.id || r.receiver_id === user.id);
    const ids = mine.map((r: any) => r.sender_id === user.id ? r.receiver_id : r.sender_id);
    if (ids.length === 0) { Alert.alert('No friends', 'Add a friend first.'); return; }
    const { data: profiles } = await supabase.from('user_profiles').select('user_id,email,first_name,last_name,avatar_url').in('user_id', ids);
    setForwardList(profiles || []);
    setForwardFor(m);
  };

  const doForward = async (targetUserId: string) => {
    if (!forwardFor || !user) return;
    const m = forwardFor;
    setForwardFor(null);
    try {
      const { data: rid, error: ridErr } = await supabase.rpc('get_or_create_dm', { other_user_id: targetUserId });
      if (ridErr || !rid) throw ridErr || new Error('no room');
      const ridVal = rid as unknown as string;
      const body = m.attachment_type ? m.body : m.body;
      const insert: any = { room_id: ridVal, sender_id: user.id, body, forwarded: true };
      if (m.attachment_url) { insert.attachment_url = m.attachment_url; insert.attachment_type = m.attachment_type; }
      if (m.duration_ms) insert.duration_ms = m.duration_ms;
      await supabase.from('chat_messages').insert(insert);
      Alert.alert('Forwarded', 'Message sent.');
    } catch (e: any) {
      Alert.alert('Forward failed', e && e.message ? e.message : 'Try again');
    }
  };

  const openSearch = () => { setSearchOpen(true); setSearchQ(''); };
  const closeSearch = () => { setSearchOpen(false); setSearchQ(''); };

  const openReply = (m: Msg) => {
    setMenuFor(null);
    setReplyTo(m);
  };

  const renderItem = ({ item, index }: { item: Msg; index: number }) => {
    const mine = item.sender_id === user?.id;
    const prev = messages[index - 1];
    const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(item.created_at);
    const isImage = !!item.attachment_url && item.attachment_type === 'image';
    const isFile = !!item.attachment_url && item.attachment_type === 'file';
    const isLocation = item.attachment_type === 'location';
    const isText = !isImage && !isFile && !isLocation;
    const caption = item.body && item.body.trim() ? item.body : null;
    const myReactions = reactions[String(item.id)] || [];
    const replyMsg = item.reply_to_id ? messages.find((x) => String(x.id) === String(item.reply_to_id)) : null;

    return (
      <View>
        {showDay ? <Text style={styles.daySep}>{dayLabel(item.created_at)}</Text> : null}
        <Pressable
          onLongPress={() => setMenuFor(item)}
          delayLongPress={300}
          style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}
        >
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, isImage && { padding: 4, paddingBottom: 4 }]}>
            {isGroup && !mine ? (
              <Text style={styles.senderName}>{memberMap[item.sender_id] || 'Member'}</Text>
            ) : null}
            {mine ? <View style={styles.tailRight} /> : <View style={styles.tailLeft} />}

            {item.deleted_for_everyone ? (
              <Text style={[styles.deletedTxt, mine ? styles.textMine : styles.textTheirs]}>This message was deleted</Text>
            ) : (
              <>
                {replyMsg ? (
                  <View style={[styles.replyQuote, mine ? styles.replyQuoteMine : styles.replyQuoteTheirs]}>
                    <Text style={styles.replyQuoteName} numberOfLines={1}>{replyMsg.sender_id === user?.id ? 'You' : otherName}</Text>
                    <Text style={styles.replyQuoteBody} numberOfLines={2}>{replyMsg.deleted_for_everyone ? 'Deleted message' : replyMsg.body}</Text>
                  </View>
                ) : null}

                {isImage ? (
                  <Pressable onPress={() => item.attachment_url && Linking.openURL(item.attachment_url)}>
                    <Image source={{ uri: item.attachment_url || '' }} style={styles.attachImg} resizeMode='cover' />
                  </Pressable>
                ) : null}

                {item.attachment_type === 'audio' ? (
                  <Pressable onPress={() => playVoice(item)} style={styles.voiceRow}>
                    <View style={[styles.playBtn, { backgroundColor: mine ? 'rgba(0,0,0,0.25)' : 'rgba(0,255,136,0.15)' }]}>
                      <Text style={[styles.playIcon, { color: mine ? '#fff' : '#00ff88' }]}>{playingId === item.id ? '❚❚' : '▶'}</Text>
                    </View>
                    <View style={styles.waveWrap}>
                      {[6, 12, 18, 22, 16, 10, 20, 24, 14, 8, 16, 20, 12, 6, 18, 22, 10, 14, 8, 16].map((h, wi) => (
                        <View key={wi} style={[styles.waveBar, { height: h, backgroundColor: mine ? 'rgba(255,255,255,0.7)' : '#00ff88' }]} />
                      ))}
                    </View>
                    <Text style={[styles.voiceDuration, mine ? styles.timeMine : styles.timeTheirs]}>{fmtDuration(item.duration_ms || 0)}</Text>
                  </Pressable>
                ) : null}

                {isFile ? (
                  <Pressable onPress={() => item.attachment_url && Linking.openURL(item.attachment_url)} style={styles.fileRow}>
                    <View style={[styles.fileIcon, { backgroundColor: mine ? 'rgba(0,0,0,0.25)' : 'rgba(0,255,136,0.15)' }]}>
                      <Text style={[styles.fileIconTxt, { color: mine ? '#fff' : '#00ff88' }]}>FILE</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fileName, mine ? styles.textMine : styles.textTheirs]} numberOfLines={1}>{caption || 'Attachment'}</Text>
                      <Text style={[styles.fileMeta, mine ? styles.timeMine : styles.timeTheirs]}>Tap to open</Text>
                    </View>
                  </Pressable>
                ) : null}

                {isLocation ? (
                  <View style={styles.fileRow}>
                    <View style={[styles.fileIcon, { backgroundColor: mine ? 'rgba(0,0,0,0.25)' : 'rgba(0,255,136,0.15)' }]}>
                      <Text style={[styles.fileIconTxt, { color: mine ? '#fff' : '#00ff88' }]}>MAP</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fileName, mine ? styles.textMine : styles.textTheirs]} numberOfLines={1}>{caption || 'Location'}</Text>
                    </View>
                  </View>
                ) : null}

                {isText ? (
                  <Text style={[styles.bubbleText, mine ? styles.textMine : styles.textTheirs]}>{caption}</Text>
                ) : null}

                {item.forwarded ? (
                  <Text style={[styles.forwardedTxt, mine ? styles.timeMine : styles.timeTheirs]}>Forwarded</Text>
                ) : null}

                <View style={styles.metaRow}>
                  {item.edited_at ? <Text style={[styles.editedTxt, mine ? styles.timeMine : styles.timeTheirs]}>edited </Text> : null}
                  <Text style={[styles.bubbleTime, mine ? styles.timeMine : styles.timeTheirs]}>{timeOf(item.created_at)}</Text>
                  {mine ? (
                    item.read_at ? <Text style={[styles.ticks, { color: '#53bdeb' }]}>✓✓</Text>
                      : item.delivered_at ? <Text style={[styles.ticks, styles.timeMine]}>✓✓</Text>
                      : <Text style={[styles.ticks, styles.timeMine]}>✓</Text>
                  ) : null}
                </View>
              </>
            )}

            {myReactions.length > 0 ? (
              <View style={styles.reactionsRow}>
                {Object.entries(myReactions.reduce((acc: any, r: any) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})).map(([emoji, n]: any) => (
                  <View key={emoji} style={styles.reactionChip}>
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    {n > 1 ? <Text style={styles.reactionCount}>{n}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
    );
  };

  return (

    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>

      <View style={styles.header}>

        <Pressable onPress={() => router.back()} style={styles.backBtn}>

          <Text style={styles.backText}>{'<'}</Text>

        </Pressable>

        <View style={styles.avatarWrap}>

          {otherAvatar ? (

            <Image source={{ uri: otherAvatar }} style={styles.avatar} />

          ) : (

            <View style={styles.avatarFallback}><Text style={styles.avatarText}>{otherName.charAt(0).toUpperCase()}</Text></View>

          )}

          {otherOnline ? <View style={styles.onlineDot} /> : null}

        </View>

        <View style={{ flex: 1 }}>

          <Text style={styles.name} numberOfLines={1}>{otherName}</Text>

          <Text style={styles.sub}>{otherTyping ? 'typing...' : otherOnline ? 'online' : 'tap for info'}</Text>

        </View>

      </View>


      {busy ? (

        <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>

      ) : messages.length === 0 ? (

        <View style={styles.center}>

          <Text style={styles.emptyTitle}>Say hi to {otherName}</Text>

          <Text style={styles.emptySub}>Messages are private between you two.</Text>

        </View>

      ) : (

        <FlatList

          ref={listRef}

          data={searchQ.trim() ? messages.filter((m) => (m.body || '').toLowerCase().includes(searchQ.toLowerCase())) : messages}

          keyExtractor={(item) => String(item.id)}

          renderItem={renderItem}

          contentContainerStyle={styles.list}

          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}

          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}

        />

      )}


      {replyTo ? (

        <View style={styles.replyBar}>

          <View style={styles.replyBarContent}>

            <Text style={styles.replyBarName}>{replyTo.sender_id === user?.id ? 'You' : otherName}</Text>

            <Text style={styles.replyBarBody} numberOfLines={1}>{replyTo.body}</Text>

          </View>

          <Pressable onPress={() => setReplyTo(null)} style={styles.replyBarClose}><Text style={styles.replyBarCloseTxt}>X</Text></Pressable>

        </View>

      ) : null}


      <View style={styles.inputBar}>

        <Pressable onPress={() => setAttachOpen(true)} style={styles.attachBtn}>

          <Text style={styles.attachIcon}>+</Text>

        </Pressable>

        <TextInput

          value={text}

          onChangeText={(v) => { setText(v); bumpTyping(); }}

          placeholder='Message'

          placeholderTextColor={palette.textDim}

          style={styles.input}

          multiline

        />

        <Pressable onPress={text.trim() ? sendText : () => pickImage('library')} disabled={sending || uploading} style={styles.sendBtn}>

          {sending || uploading ? <ActivityIndicator color='#fff' size='small' /> : <Text style={styles.sendIcon}>{text.trim() ? '➤' : 'CAM'}</Text>}

        </Pressable>

      </View>


      <Modal visible={attachOpen} transparent animationType='fade' onRequestClose={() => setAttachOpen(false)}>

        <Pressable style={styles.attachBg} onPress={() => setAttachOpen(false)}>

          <View style={styles.attachSheet}>

            <Text style={styles.attachTitle}>Share</Text>

            <View style={styles.attachGrid}>

              <Pressable onPress={() => pickImage('camera')} style={styles.attachItem}><Text style={styles.attachEmoji}>CAM</Text><Text style={styles.attachLbl}>Camera</Text></Pressable>

              <Pressable onPress={() => pickImage('library')} style={styles.attachItem}><Text style={styles.attachEmoji}>IMG</Text><Text style={styles.attachLbl}>Gallery</Text></Pressable>

              <Pressable onPress={pickFile} style={styles.attachItem}><Text style={styles.attachEmoji}>FILE</Text><Text style={styles.attachLbl}>Document</Text></Pressable>

              <Pressable onPress={shareLocation} style={styles.attachItem}><Text style={styles.attachEmoji}>MAP</Text><Text style={styles.attachLbl}>Location</Text></Pressable>

            </View>

          </View>

        </Pressable>

      </Modal>


      <Modal visible={!!menuFor} transparent animationType='fade' onRequestClose={() => setMenuFor(null)}>

        <Pressable style={styles.menuBg} onPress={() => setMenuFor(null)}>

          <View style={styles.menuSheet}>

            <View style={styles.reactBar}>

              {REACTIONS.map((e) => (

                <Pressable key={e} onPress={() => menuFor && react(menuFor, e)} style={styles.reactBtn}>

                  <Text style={styles.reactBtnTxt}>{e}</Text>

                </Pressable>

              ))}

            </View>

            <Pressable onPress={() => menuFor && openReply(menuFor)} style={styles.menuItem}><Text style={styles.menuItemTxt}>Reply</Text></Pressable>

            <Pressable onPress={() => menuFor && copyMsg(menuFor)} style={styles.menuItem}><Text style={styles.menuItemTxt}>Copy</Text></Pressable>
            <Pressable onPress={() => menuFor && toggleStar(menuFor)} style={styles.menuItem}><Text style={styles.menuItemTxt}>{menuFor && starred.has(String(menuFor.id)) ? 'Unstar message' : 'Star message'}</Text></Pressable>
            <Pressable onPress={() => menuFor && openForward(menuFor)} style={styles.menuItem}><Text style={styles.menuItemTxt}>Forward</Text></Pressable>
            {menuFor && menuFor.sender_id === user?.id && menuFor.attachment_type == null ? (
              <Pressable onPress={() => menuFor && openEdit(menuFor)} style={styles.menuItem}><Text style={styles.menuItemTxt}>Edit</Text></Pressable>
            ) : null}

            <Pressable onPress={() => menuFor && deleteForMe(menuFor)} style={styles.menuItem}><Text style={[styles.menuItemTxt, { color: palette.danger }]}>Delete for me</Text></Pressable>

            {menuFor && menuFor.sender_id === user?.id ? (

              <Pressable onPress={() => menuFor && deleteForEveryone(menuFor)} style={styles.menuItem}><Text style={[styles.menuItemTxt, { color: palette.danger }]}>Delete for everyone</Text></Pressable>

            ) : null}

          </View>

        </Pressable>

      </Modal>

    </KeyboardAvoidingView>

  );

}


const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingTop: 60, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  backText: { fontSize: 24, color: '#fff', fontWeight: '300', lineHeight: 26 },
  avatarWrap: { width: 40, height: 40, position: 'relative' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#005c4b', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '900', color: '#00ff88' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#25d366', borderWidth: 2, borderColor: '#0b141a' },
  name: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sub: { fontSize: 11, color: '#8696a0', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#8696a0', textAlign: 'center', marginTop: 6 },
  list: { padding: 12, paddingBottom: 8 },
  daySep: { alignSelf: 'center', fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#8696a0', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginVertical: 12 },
  msgRow: { marginVertical: 2, flexDirection: 'row' },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, position: 'relative' },
  bubbleMine: { backgroundColor: '#005c4b', borderTopRightRadius: 10, borderBottomRightRadius: 2 },
  bubbleTheirs: { backgroundColor: '#202c33', borderTopLeftRadius: 10, borderBottomLeftRadius: 2 },
  tailRight: { position: 'absolute', right: -6, bottom: 0, width: 0, height: 0, borderLeftWidth: 6, borderLeftColor: '#005c4b', borderTopWidth: 6, borderTopColor: 'transparent' },
  tailLeft: { position: 'absolute', left: -6, bottom: 0, width: 0, height: 0, borderRightWidth: 6, borderRightColor: '#202c33', borderTopWidth: 6, borderTopColor: 'transparent' },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  textMine: { color: '#e9edef' },
  textTheirs: { color: '#e9edef' },
  deletedTxt: { fontSize: 14, fontStyle: 'italic', opacity: 0.6 },
  replyQuote: { borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 4, marginBottom: 6, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.2)' },
  replyQuoteMine: { borderLeftColor: '#53bdeb' },
  replyQuoteTheirs: { borderLeftColor: '#00ff88' },
  replyQuoteName: { fontSize: 12, fontWeight: '800', color: '#53bdeb' },
  replyQuoteBody: { fontSize: 12, color: '#c9d1d6', marginTop: 2 },
  attachImg: { width: 220, height: 220, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.15)' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200, paddingVertical: 4 },
  fileIcon: { width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fileIconTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  fileName: { fontSize: 14, fontWeight: '700' },
  fileMeta: { fontSize: 11, marginTop: 2 },
  forwardedTxt: { fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
  bubbleTime: { fontSize: 10 },
  timeMine: { color: 'rgba(233,237,239,0.6)' },
  timeTheirs: { color: '#8696a0' },
  editedTxt: { fontSize: 10, fontStyle: 'italic' },
  ticks: { fontSize: 12, fontWeight: '900', letterSpacing: -2 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 10, fontWeight: '800', color: '#c9d1d6' },
  replyBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#1f2c33', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  replyBarContent: { flex: 1, borderLeftWidth: 3, borderLeftColor: '#00ff88', paddingLeft: 10 },
  replyBarName: { fontSize: 12, fontWeight: '800', color: '#00ff88' },
  replyBarBody: { fontSize: 12, color: '#c9d1d6', marginTop: 2 },
  replyBarClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  replyBarCloseTxt: { fontSize: 16, color: '#8696a0', fontWeight: '900' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#0b141a', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  attachBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1f2c33', alignItems: 'center', justifyContent: 'center' },
  attachIcon: { fontSize: 24, color: '#00ff88', fontWeight: '300', lineHeight: 26 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: '#1f2c33', color: '#fff', fontSize: 15 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#00a884', alignItems: 'center', justifyContent: 'center' },
  sendIcon: { fontSize: 18, color: '#fff', fontWeight: '900' },
  attachBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  attachSheet: { backgroundColor: '#1f2c33', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  attachTitle: { fontSize: 16, fontWeight: '900', color: '#fff', marginBottom: 16 },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  attachItem: { width: '22%', aspectRatio: 1, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', gap: 6 },
  attachEmoji: { fontSize: 14, fontWeight: '900', color: '#00ff88', letterSpacing: 1 },
  attachLbl: { fontSize: 10, fontWeight: '700', color: '#c9d1d6' },
  menuBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  menuSheet: { backgroundColor: '#1f2c33', borderRadius: 16, padding: 8, width: 260 },
  reactBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  reactBtn: { padding: 6 },
  reactBtnTxt: { fontSize: 24 },
  menuItem: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8 },
  menuItemTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
