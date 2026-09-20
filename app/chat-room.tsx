import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

interface Msg {
  id: number | string;
  sender_id: string;
  body: string;
  created_at: string;
}

export default function ChatRoom() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('Chat');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const markRead = async (rid: string) => {
    if (!user) return;
    await supabase
      .from('chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', rid)
      .eq('user_id', user.id);
  };

  const load = useCallback(async () => {
    if (!user || !uid) return;
    setBusy(true);
    try {
      // Other user's profile
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('email,first_name,last_name')
        .eq('user_id', uid)
        .maybeSingle();

      if (prof) {
        const n = ((prof.first_name || '') + ' ' + (prof.last_name || '')).trim();
        setOtherName(n || (prof.email ? prof.email.split('@')[0] : 'Chat'));
      }

      // Get or create the DM room
      const { data: rid, error: ridErr } = await supabase.rpc('get_or_create_dm', {
        other_user_id: uid,
      });
      if (ridErr || !rid) throw ridErr || new Error('no room');
      const roomIdValue = rid as unknown as string;
      setRoomId(roomIdValue);

      // Load messages
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('id,sender_id,body,created_at')
        .eq('room_id', roomIdValue)
        .order('created_at', { ascending: true })
        .limit(200);

      setMessages((msgs || []) as Msg[]);
      await markRead(roomIdValue);
    } catch (e) {
      console.log('room load error', e);
    } finally {
      setBusy(false);
    }
  }, [user, uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime subscription
  useEffect(() => {
    if (!roomId || !user) return;
    const channel = supabase
      .channel('room:' + roomId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: 'room_id=eq.' + roomId,
        },
        (payload) => {
          const newMsg = payload.new as Msg;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.sender_id !== user.id) {
            markRead(roomId);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user]);

  const send = async () => {
    if (!text.trim() || !roomId || !user) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      await supabase.from('chat_messages').insert({
        room_id: roomId,
        sender_id: user.id,
        body,
      });
      await supabase
        .from('chat_rooms')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', roomId);
    } catch (e) {
      console.log('send error', e);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const mine = item.sender_id === user?.id;
    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
            {item.body}
          </Text>
          <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{otherName}</Text>
          <Text style={styles.sub}>GAIA Messenger</Text>
        </View>
      </View>

      {busy ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.neon} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>M</Text>
          <Text style={styles.emptyTitle}>Say hi to {otherName}</Text>
          <Text style={styles.emptySub}>
            Your messages are private. Start the conversation below.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={palette.textDim}
          style={styles.input}
          multiline
        />
        <Pressable
          onPress={send}
          disabled={!text.trim() || sending}
          style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
        >
          {sending
            ? <ActivityIndicator color={palette.obsidian} size="small" />
            : <Text style={styles.sendText}>Send</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.obsidian },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: 60,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
    },
    backText: { fontSize: 26, color: palette.neon, lineHeight: 28, fontWeight: '300' },
    name: { fontSize: 17, fontWeight: '800', color: palette.text, letterSpacing: -0.3 },
    sub: { ...typography.micro, color: palette.neon, marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
    emptyIcon: { fontSize: 56, color: palette.neonSoft, fontWeight: '900', marginBottom: spacing.md },
    emptyTitle: { ...typography.heading, color: palette.text, textAlign: 'center' },
    emptySub: {
      ...typography.body, color: palette.textMuted,
      textAlign: 'center', marginTop: 6, lineHeight: 22,
    },
    list: { padding: spacing.lg, paddingBottom: spacing.lg },
    msgRow: { marginVertical: 4, flexDirection: 'row' },
    msgRowMine: { justifyContent: 'flex-end' },
    msgRowTheirs: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '78%',
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: 18,
    },
    bubbleMine: { backgroundColor: palette.neon, borderBottomRightRadius: 6 },
    bubbleTheirs: {
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      borderBottomLeftRadius: 6,
    },
    bubbleText: { fontSize: 15, lineHeight: 21 },
    bubbleTextMine: { color: palette.obsidian, fontWeight: '600' },
    bubbleTextTheirs: { color: palette.text },
    bubbleTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
    bubbleTimeMine: { color: 'rgba(0,0,0,0.55)' },
    bubbleTimeTheirs: { color: palette.textDim },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: palette.border,
      backgroundColor: palette.obsidian,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderRadius: 22,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      color: palette.text,
      fontSize: 15,
    },
    sendBtn: {
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 22,
      backgroundColor: palette.neon,
      minWidth: 70,
      alignItems: 'center',
    },
    sendText: { fontSize: 14, fontWeight: '800', color: palette.obsidian },
  });
