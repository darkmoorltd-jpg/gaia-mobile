import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Modal, useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, withDelay, Easing, withSpring,
} from 'react-native-reanimated';
import {
  useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync,
} from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import Markdown from 'react-native-markdown-display';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

const EASE_OUT = Easing.out(Easing.quad);
const EASE_IN = Easing.in(Easing.quad);

interface Msg {
  role: 'user' | 'ai';
  text: string;
  time: string;
}

interface Conv {
  id: string;
  title: string;
  updated_at: string;
}

export default function Voice() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const { width: screenW } = useWindowDimensions();
  const styles = createStyles(palette);
  const markdownStyles = createMarkdownStyles(palette);

  const drawerWidth = Math.min(320, screenW * 0.85);

  // ---- State ----
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'ai',
      text:
        'Hello. I am **GAIA**, your personal agronomist.\n\n' +
        'Ask me anything about your farm — crops, pests, soil, or livestock.\n\n' +
        'Tap the mic to speak, or the speaker icon on any reply to have me read it aloud.',
      time: now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const drawerX = useSharedValue(-drawerWidth);

  // ---- Dancing tomatoes ----
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);
  const t3 = useSharedValue(0);

  useEffect(() => {
    if (busy) {
      const bounce = () =>
        withRepeat(
          withSequence(
            withTiming(1, { duration: 350, easing: EASE_OUT }),
            withTiming(0, { duration: 350, easing: EASE_IN }),
          ),
          -1,
          false,
        );
      t1.value = bounce();
      t2.value = withDelay(120, bounce());
      t3.value = withDelay(240, bounce());
    } else {
      t1.value = withTiming(0);
      t2.value = withTiming(0);
      t3.value = withTiming(0);
    }
  }, [busy]);

  const t1Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -14 * t1.value },
      { rotate: String(-12 + t1.value * 24) + 'deg' },
      { scale: 1 + t1.value * 0.15 },
    ],
  }));
  const t2Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -14 * t2.value },
      { rotate: String(-12 + t2.value * 24) + 'deg' },
      { scale: 1 + t2.value * 0.15 },
    ],
  }));
  const t3Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -14 * t3.value },
      { rotate: String(-12 + t3.value * 24) + 'deg' },
      { scale: 1 + t3.value * 0.15 },
    ],
  }));

  // ---- Sidebar animation ----
  useEffect(() => {
    drawerX.value = withTiming(sidebarOpen ? 0 : -drawerWidth, { duration: 240 });
  }, [sidebarOpen, drawerWidth]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: sidebarOpen ? 1 : 0,
  }));

  // ---- Audio recorder ----
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const scrollBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  // ---- Load conversations on mount ----
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('agronomist_conversations')
          .select('id, title, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(50);
        if (data) setConversations(data as any);
      } catch {}
    })();
  }, [user]);

  // ---- Save a single message ----
  const saveMessage = async (convId: string, role: 'user' | 'ai', text: string) => {
    if (!user) return;
    try {
      await supabase.from('agronomist_messages').insert({
        conversation_id: convId,
        user_id: user.id,
        role,
        content: text,
      });
    } catch {}
  };

  // ---- Create new conversation ----
  const ensureConversation = async (firstUserMsg: string): Promise<string | null> => {
    if (!user) return null;
    if (currentConvId) return currentConvId;
    try {
      const title = firstUserMsg.slice(0, 40) + (firstUserMsg.length > 40 ? '…' : '');
      const { data, error } = await supabase
        .from('agronomist_conversations')
        .insert({ user_id: user.id, title })
        .select('id, title, updated_at')
        .single();
      if (error || !data) return null;
      setCurrentConvId(data.id);
      setConversations((prev) => [data as any, ...prev]);
      return data.id;
    } catch {
      return null;
    }
  };

  const touchConversation = async (convId: string) => {
    try {
      await supabase
        .from('agronomist_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId);
    } catch {}
  };

  // ---- Load a past conversation ----
  const loadConversation = async (conv: Conv) => {
    setSidebarOpen(false);
    try {
      const { data } = await supabase
        .from('agronomist_messages')
        .select('role, content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
      if (data) {
        setMessages(
          data.map((m: any) => ({
            role: m.role,
            text: m.content,
            time: timeOf(m.created_at),
          })),
        );
        setCurrentConvId(conv.id);
        scrollBottom();
      }
    } catch {}
  };

  // ---- Start a fresh conversation ----
  const startNewConversation = () => {
    setCurrentConvId(null);
    setMessages([
      {
        role: 'ai',
        text:
          'New conversation. Ask me anything about your farm — crops, pests, soil, or livestock.',
        time: now(),
      },
    ]);
    setSidebarOpen(false);
  };

  // ---- Recording ----
  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone needed', 'Please allow GAIA to access your mic.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e: any) {
      Alert.alert('Recording failed', e?.message || 'unknown');
    }
  };

  const stopAndTranscribe = async () => {
    try {
      setRecording(false);
      await recorder.stop();
      try {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      } catch {}

      const uri = recorder.uri;
      if (!uri) throw new Error('No audio file');
      setTranscribing(true);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      if (!token) throw new Error('Session expired');

      const fileResponse = await fetch(uri);
      const audioBlob = await fileResponse.blob();
      const form = new FormData();
      form.append('audio', audioBlob, 'voice.m4a');

      const res = await fetch(API_BASE + '/transcribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error('Transcribe ' + res.status + ': ' + errText.slice(0, 120));
      }
      const data = await res.json();
      const text = (data.text || '').trim();
      if (text) setInput(text);
      else Alert.alert('No speech detected', 'Please try again.');
    } catch (e: any) {
      Alert.alert('Transcription failed', e?.message || 'unknown');
    } finally {
      setTranscribing(false);
    }
  };

  // ---- Send ----
  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;

    const userMsg: Msg = { role: 'user', text: q, time: now() };
    const history = [...messages, userMsg].map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }));

    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);
    scrollBottom();

    // Ensure conversation and save the user message
    const convId = await ensureConversation(q);
    if (convId) {
      await saveMessage(convId, 'user', q);
      await touchConversation(convId);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      if (!token) throw new Error('Session expired');

      const res = await fetch(API_BASE + '/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ messages: history, max_tokens: 1500 }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error('Server ' + res.status + ': ' + errText.slice(0, 120));
      }
      const data = await res.json();
      const reply = data.reply || 'No reply from GAIA.';
      setMessages((m) => [...m, { role: 'ai', text: reply, time: now() }]);
      if (convId) {
        await saveMessage(convId, 'ai', reply);
        await touchConversation(convId);
      }
    } catch (e: any) {
      const errMsg = 'Error: ' + (e?.message || 'unknown');
      setMessages((m) => [...m, { role: 'ai', text: errMsg, time: now() }]);
      if (convId) await saveMessage(convId, 'ai', errMsg);
    } finally {
      setBusy(false);
      scrollBottom();
    }
  };

  // ---- Copy ----
  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Message copied to clipboard.');
  };

  // ---- TTS ----
  const speak = async (text: string, idx: number) => {
    // Stop if already speaking this one
    if (speakingIdx === idx) {
      Speech.stop();
      setSpeakingIdx(null);
      return;
    }
    Speech.stop();
    setSpeakingIdx(idx);
    // Strip markdown so TTS doesn't read "asterisk asterisk"
    const clean = text
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#+\s?/g, '')
      .replace(/\|/g, ' ')
      .replace(/\n{2,}/g, '. ');
    Speech.speak(clean, {
      language: 'en-US',
      rate: 0.95,
      pitch: 1.0,
      onDone: () => setSpeakingIdx(null),
      onStopped: () => setSpeakingIdx(null),
      onError: () => setSpeakingIdx(null),
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}
    >
      {/* ===== Header ===== */}
      <View style={styles.header}>
        <Pressable onPress={() => setSidebarOpen(true)} style={styles.hamburger}>
          <Text style={styles.hamburgerIcon}>☰</Text>
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>🧑‍🌾</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>GAIA Agronomist</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSub}>
              {busy ? 'Thinking...' : recording ? 'Listening...' : 'Online — ready to help'}
            </Text>
          </View>
        </View>
        <Pressable onPress={startNewConversation} style={styles.newChatBtn}>
          <Text style={styles.newChatIcon}>＋</Text>
        </Pressable>
      </View>

      {/* ===== Messages ===== */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m, i) => (
          <View
            key={i}
            style={[styles.row, m.role === 'user' ? styles.rowUser : styles.rowAi]}
          >
            {m.role === 'ai' ? (
              <View style={styles.smallAvatar}>
                <Text style={styles.smallAvatarEmoji}>🧑‍🌾</Text>
              </View>
            ) : null}

            <View
              style={[
                styles.bubble,
                m.role === 'user' ? styles.bubbleUser : styles.bubbleAi,
              ]}
            >
              {m.role === 'user' ? (
                <Text style={styles.bubbleTextUser}>{m.text}</Text>
              ) : (
                <Markdown style={markdownStyles}>{m.text}</Markdown>
              )}

              <View style={styles.bubbleFooter}>
                <Text
                  style={[
                    styles.bubbleTime,
                    m.role === 'user' ? styles.bubbleTimeUser : styles.bubbleTimeAi,
                  ]}
                >
                  {m.time}
                </Text>
                <View style={styles.actions}>
                  <Pressable onPress={() => copyToClipboard(m.text)} style={styles.actionBtn}>
                    <Text style={styles.actionIcon}>⧉</Text>
                  </Pressable>
                  {m.role === 'ai' ? (
                    <Pressable onPress={() => speak(m.text, i)} style={styles.actionBtn}>
                      <Text style={styles.actionIcon}>
                        {speakingIdx === i ? '⏸' : '🔊'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        ))}

        {busy ? (
          <View style={[styles.row, styles.rowAi]}>
            <View style={styles.smallAvatar}>
              <Text style={styles.smallAvatarEmoji}>🧑‍🌾</Text>
            </View>
            <View style={[styles.bubble, styles.bubbleAi, styles.thinkingBubble]}>
              <View style={styles.tomatoRow}>
                <Animated.Text style={[styles.tomato, t1Style]}>🍅</Animated.Text>
                <Animated.Text style={[styles.tomato, t2Style]}>🍅</Animated.Text>
                <Animated.Text style={[styles.tomato, t3Style]}>🍅</Animated.Text>
              </View>
              <Text style={styles.thinkingText}>GAIA is thinking...</Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ===== Input bar ===== */}
      <View style={styles.inputBar}>
        <Pressable
          onPress={recording ? stopAndTranscribe : startRecording}
          disabled={busy || transcribing}
          style={[
            styles.micBtn,
            recording && styles.micBtnActive,
            (busy || transcribing) && { opacity: 0.5 },
          ]}
        >
          {transcribing ? (
            <ActivityIndicator color={palette.obsidian} size="small" />
          ) : (
            <Text style={styles.micIcon}>{recording ? '■' : '🎤'}</Text>
          )}
        </Pressable>

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={recording ? 'Listening...' : 'Type or tap the mic...'}
          placeholderTextColor={palette.textDim}
          style={styles.input}
          multiline
          editable={!busy && !recording && !transcribing}
          maxLength={1000}
        />

        <Pressable
          onPress={send}
          disabled={busy || !input.trim() || recording || transcribing}
          style={[
            styles.sendBtn,
            (busy || !input.trim() || recording || transcribing) && { opacity: 0.4 },
          ]}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>

      {recording ? (
        <View style={styles.recordingBar}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>Recording — tap the square to stop and transcribe</Text>
        </View>
      ) : null}

      {/* ===== Sidebar (history) ===== */}
      <Modal visible={sidebarOpen} transparent animationType="none" onRequestClose={() => setSidebarOpen(false)}>
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={sidebarOpen ? 'auto' : 'none'}>
          <Pressable style={{ flex: 1 }} onPress={() => setSidebarOpen(false)} />
        </Animated.View>

        <Animated.View style={[styles.drawer, { width: drawerWidth }, drawerStyle]}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerKicker}>HISTORY</Text>
            <Text style={styles.drawerTitle}>Conversations</Text>
          </View>

          <Pressable onPress={startNewConversation} style={styles.drawerNewBtn}>
            <Text style={styles.drawerNewText}>＋  New conversation</Text>
          </Pressable>

          <ScrollView contentContainerStyle={styles.drawerScroll}>
            {conversations.length === 0 ? (
              <Text style={styles.drawerEmpty}>No past conversations yet.</Text>
            ) : (
              conversations.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => loadConversation(c)}
                  style={[
                    styles.drawerItem,
                    currentConvId === c.id && styles.drawerItemActive,
                  ]}
                >
                  <Text style={styles.drawerItemTitle} numberOfLines={1}>{c.title}</Text>
                  <Text style={styles.drawerItemDate}>{timeOf(c.updated_at)}</Text>
                </Pressable>
              ))
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ============================================
// Utilities
// ============================================
function now() {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return hr + ':' + m + ' ' + ampm;
}

function timeOf(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 1) return 'Just now';
    if (diffH < 24) return Math.floor(diffH) + 'h ago';
    if (diffH < 48) return 'Yesterday';
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}

// ============================================
// Styles
// ============================================
const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  },
  hamburger: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  hamburgerIcon: { fontSize: 22, color: p.text, fontWeight: '700' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 20 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: p.text, letterSpacing: -0.3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: p.neon },
  headerSub: { fontSize: 11, color: p.textMuted },
  newChatBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  newChatIcon: { fontSize: 20, color: p.neon, fontWeight: '900' },

  scroll: { padding: 16, paddingBottom: 20 },

  row: { marginBottom: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  smallAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  smallAvatarEmoji: { fontSize: 15 },

  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: { backgroundColor: p.neon, borderBottomRightRadius: 5 },
  bubbleAi: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderBottomLeftRadius: 5,
  },
  bubbleTextUser: { fontSize: 15, lineHeight: 21, color: p.obsidian, fontWeight: '600' },

  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  bubbleTime: { fontSize: 9, opacity: 0.6 },
  bubbleTimeUser: { color: p.obsidian },
  bubbleTimeAi: { color: p.textMuted },

  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  actionIcon: { fontSize: 14, color: p.neon, opacity: 0.85 },

  thinkingBubble: { paddingVertical: 14 },
  tomatoRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'flex-end', height: 30 },
  tomato: { fontSize: 22 },
  thinkingText: { fontSize: 11, color: p.textMuted, textAlign: 'center', marginTop: 6 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: p.border,
    backgroundColor: p.obsidian,
  },
  micBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: p.surface,
    borderWidth: 1.5, borderColor: p.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: p.danger, borderColor: p.danger },
  micIcon: { fontSize: 20 },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 23,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    color: p.text,
    fontSize: 14,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 23,
    backgroundColor: p.neon,
    justifyContent: 'center',
  },
  sendBtnText: { fontSize: 13, fontWeight: '800', color: p.obsidian, letterSpacing: 0.5 },

  recordingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: 'rgba(255, 60, 90, 0.12)',
    borderTopWidth: 1, borderTopColor: p.danger,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: p.danger },
  recText: { fontSize: 12, color: p.danger, fontWeight: '600' },

  // ---- Sidebar ----
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  drawer: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    backgroundColor: p.abyss,
    borderRightWidth: 1,
    borderRightColor: p.border,
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 16,
  },
  drawerKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.neon },
  drawerTitle: { fontSize: 24, fontWeight: '900', color: p.text, letterSpacing: -0.8, marginTop: 4 },
  drawerNewBtn: {
    marginHorizontal: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: p.neonSoft,
    borderWidth: 1, borderColor: p.borderHi,
  },
  drawerNewText: { color: p.neon, fontWeight: '800', fontSize: 14 },
  drawerScroll: { padding: 16 },
  drawerItem: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border,
    marginBottom: 8,
  },
  drawerItemActive: { borderColor: p.borderHi, backgroundColor: p.neonSoft },
  drawerItemTitle: { color: p.text, fontSize: 13, fontWeight: '700' },
  drawerItemDate: { color: p.textMuted, fontSize: 10, marginTop: 4 },
  drawerEmpty: { color: p.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 30 },
});

// ============================================
// Markdown styles
// ============================================
const createMarkdownStyles = (p: any) => StyleSheet.create({
  body: { color: p.text, fontSize: 15, lineHeight: 22 },
  heading1: { color: p.text, fontSize: 20, fontWeight: '900', marginTop: 8, marginBottom: 6 },
  heading2: { color: p.text, fontSize: 18, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  heading3: { color: p.text, fontSize: 16, fontWeight: '700', marginTop: 6, marginBottom: 4 },
  strong: { fontWeight: '800', color: p.text },
  backgroundColor em: { fontStyle: 'italic' },
  paragraph: {: marginTop: 4, marginBottom: 6 ', flexWrap: 'wrap' },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  bullet_list_icon: { color: p.neon, marginRight: 6 },
  ordered_list_icon: { color: p.neon, marginRight: 6 },
  code_inline: {
    backgroundColor: 'rgba(0,255,136,0.12)',
    color: p.neon,
    paddingHorizontal: 4,
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  code_block: {
    backgroundColor: p.abyss,
    borderColor: p.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 12,
    color: p.text,
    marginVertical: 6,
  },
  fence: {
    backgroundColor: p.abyss,
    borderColor: p.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 12,
    color: p.text,
    marginVertical: 6,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: p.neon,
    paddingLeft: 10,
    marginVertical: 6,
    opacity: 0.9,
  },
  link: { color: p.neon, textDecorationLine: 'underline' },
  hr: { backgroundColor: p.border, height: 1, marginVertical: 8 },
  // ---- Tables ----
  table: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
  thead: {rgba(0,255,136,0.10)' },
  tbody: {},
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  },
  th: {
    flex: 1,
    padding: 8,
    fontWeight: '800',
    color: p.text,
    fontSize: 13,
    borderRightWidth: 1,
    borderRightColor: p.border,
  },
  td: {
    flex: 1,
    padding: 8,
    color: p.text,
    fontSize: 13,
    borderRightWidth: 1,
    borderRightColor: p.border,
  },
});
