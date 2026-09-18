import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import {
  fetchMessages, sendMessage, markMessagesRead, setTyping,
  subscribeToIncoming, subscribeToTyping, fmtTime, fmtDayLabel, ChatMessage,
} from '../src/utils/chat';
import { displayName } from '../src/utils/friends';

export default function ChatRoom() {
  const router = useRouter();
  const params = useLocalSearchParams<{ peerId: string; peerEmail: string; peerName: string }>();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const peerId = params.peerId as string;
  const peerName = (params.peerName as string) || (params.peerEmail as string) || 'Farmer';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const typingTimer = useRef<any>(null);

  const load = useCallback(async () => {
    if (!user || !peerId) return;
    const msgs = await fetchMessages(user.id, peerId);
    setMessages(msgs);
    await markMessagesRead(user.id, peerId);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
  }, [user, peerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user || !peerId) return;
    const unsubIncoming = subscribeToIncoming(user.id, (m) => {
      if (m.sender_id === peerId) {
        setMessages((prev) => [...prev, m]);
        markMessagesRead(user.id, peerId);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      }
    });
    const unsubTyping = subscribeToTyping(user.id, peerId, () => {
      setPeerTyping(true);
      setTimeout(() => setPeerTyping(false), 3000);
    });
    return () => { unsubIncoming(); unsubTyping(); };
  }, [user, peerId]);

  const notifyTyping = () => {
    if (!user || !peerId) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(user.id, peerId), 200);
  };

  const doSend = async () => {
    if (!user || !peerId || !input.trim()) return;
    const text = input.trim();
    setInput('');
    setBusy(true);
    const { data, error } = await sendMessage(user.id, peerId, text);
    if (!error && data) {
      setMessages((prev) => [...prev, data as ChatMessage]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
    setBusy(false);
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7,
    });
    if (res.canceled || !user) return;
    const uri = res.assets[0].uri;
    setBusy(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const buf = await new Response(blob).arrayBuffer();
      const path = user.id + '/' + Date.now() + '.jpg';
      const { error } = await supabase.storage.from('verifications').upload(path, buf, { contentType: 'image/jpeg' });
      if (!error) {
        const { data } = supabase.storage.from('verifications').getPublicUrl(path);
        const { data: msg } = await sendMessage(user.id, peerId, 'photo', 'image', data.publicUrl);
        if (msg) setMessages((prev) => [...prev, msg as ChatMessage]);
      }
    } catch {}
    setBusy(false);
  };

  // group messages by date
  const grouped: { day: string; items: ChatMessage[] }[] = [];
  let currentDay = '';
  messages.forEach((m) => {
    const d = fmtDayLabel(m.created_at);
    if (d !== currentDay) {
      grouped.push({ day: d, items: [m] });
      currentDay = d;
    } else {
      grouped[grouped.length - 1].items.push(m);
    }
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{peerName[0]?.toUpperCase() || 'F'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{peerName}</Text>
          <Text style={styles.headerSub}>
            {peerTyping ? 'typing...' : 'tap to view profile'}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {grouped.map((g) => (
          <View key={g.day}>
            <View style={styles.dayDivider}>
              <Text style={styles.dayText}>{g.day}</Text>
            </View>
            {g.items.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <View key={m.id} style={[styles.msgRow, mine ? styles.msgRowMe : styles.msgRowThem]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}>
                    {m.type === 'image' && m.media_url ? (
                      <Image source={{ uri: m.media_url }} style={styles.imageMsg} />
                    ) : (
                      <Text style={[styles.bubbleText, mine ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                        {m.deleted ? 'deleted' : m.content}
                      </Text>
                    )}
                    <View style={styles.metaRow}>
                      <Text style={[styles.time, mine ? styles.timeMe : styles.timeThem]}>
                        {fmtTime(m.created_at)}
                      </Text>
                      {mine ? (
                        <Text style={[styles.tick, m.read_at ? styles.tickRead : styles.tickSent]}>
                          {m.read_at ? '✓✓' : '✓'}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputBar}>
        <Pressable onPress={pickImage} style={styles.attachBtn}>
          <Text style={styles.attachIcon}>+</Text>
        </Pressable>
        <TextInput
          value={input}
          onChangeText={(t) => { setInput(t); notifyTyping(); }}
          placeholder="Message"
          placeholderTextColor={palette.textDim}
          style={styles.input}
          multiline
        />
        <Pressable onPress={doSend} disabled={busy || !input.trim()} style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} size="small" /> : <Text style={styles.sendText}>SEND</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.abyss },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingTop: 56, paddingBottom: 12,
    backgroundColor: p.obsidian, borderBottomWidth: 1, borderBottomColor: p.border,
  },
  backBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 32, color: p.text, lineHeight: 32 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: p.neonSoft, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '900', color: p.neon },
  headerName: { fontSize: 16, fontWeight: '800', color: p.text },
  headerSub: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  scroll: { padding: 12, paddingBottom: 20 },
  dayDivider: { alignItems: 'center', marginVertical: 12 },
  dayText: {
    fontSize: 11, fontWeight: '700', color: p.textMuted,
    backgroundColor: p.surface, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12,
  },
  msgRow: { marginVertical: 2, flexDirection: 'row' },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
  },
  bubbleMe: { backgroundColor: p.neon, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: p.surface, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMe: { color: p.obsidian },
  bubbleTextThem: { color: p.text },
  imageMsg: { width: 220, height: 220, borderRadius: 12 },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 4, marginTop: 4,
  },
  time: { fontSize: 10 },
  timeMe: { color: 'rgba(0,0,0,0.55)' },
  timeThem: { color: p.textDim },
  tick: { fontSize: 11, fontWeight: '900' },
  tickSent: { color: 'rgba(0,0,0,0.4)' },
  tickRead: { color: '#0070d4' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: p.obsidian, borderTopWidth: 1, borderTopColor: p.border,
  },
  attachBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center',
  },
  attachIcon: { fontSize: 22, color: p.neon, fontWeight: '300' },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border,
    color: p.text, fontSize: 15,
  },
  sendBtn: {
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 20, backgroundColor: p.neon,
  },
  sendText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
