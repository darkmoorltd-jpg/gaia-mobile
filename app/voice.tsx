import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import {
  useAudioRecorder, AudioModule, RecordingPresets,
} from 'expo-audio';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

interface Msg {
  role: 'user' | 'ai';
  text: string;
  time: string;
}

export default function Voice() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'ai',
      text: 'Hello. I am GAIA, your personal agronomist. Ask me anything about your farm - crops, pests, soil, or livestock. Tap the mic to speak.',
      time: now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const scrollRef = useRef<ScrollView | null>(null);

  // ---- Dancing tomatoes ----
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);
  const t3 = useSharedValue(0);

  useEffect(() => {
    if (busy) {
      t1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) })
        ), -1, false,
      );
      t2.value = withDelay(120, withRepeat(
        withSequence(
          withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 350, easing: Easing.in(Easing;

.quad) })
        ), -1, false,
      ));
      t3.value = withDelay(240, withRepeat(
        withSequence(
          withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) })
        ), -1, false,
      ));
    } else {
      t1.value = withTiming(0);
      t2.value = withTiming(0);
      t3.value = withTiming(0);
    }
  }, [busy]);

  const t1Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -14 * t1.value },
      { rotate: (-12 + t1.value * 24) + 'deg' },
      { scale: 1 + t1.value * 0.15 },
    ],
  }));
  const t2Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -14 * t2.value },
      { rotate: (-12 + t2.value * 24) + 'deg' },
      { scale: 1 + t2.value * 0.15 },
    ],
  }));
  const t3Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -14 * t3.value },
      { rotate: (-12 + t3.value * 24) + 'deg' },
      { scale: 1 + t3.value * 0.15 },
    ],
  }));

  // ---- Audio recorder ----
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const scrollBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Microphone permission needed', 'Please allow GAIA to access your microphone.');
        return;
      }
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
      const uri = recorder.uri;
      if (!uri) throw new Error('No audio file');

      setTranscribing(true);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      if (!token) throw new Error('Session expired');

      const form = new FormData();
      // @ts-ignore
      form.append('audio', { uri, name: 'voice.m4a', type: 'audio/m4a' });

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
      if (text) {
        setInput(text);
      } else {
        Alert.alert('No speech detected', 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Transcription failed', e?.message || 'unknown');
    } finally {
      setTranscribing(false);
    }
  };

  const send = async (overrideText?: string) => {
    const q = (overrideText ?? input).trim();
    if (!q || busy) return    const userMsg: Msg = { role: 'user', text: q, time: now() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);
    scrollBottom();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      if (!token) throw new Error('Session expired');

      const history = [...messages, userMsg].map((m) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));

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
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'ai', text: 'Error: ' + (e?.message || 'unknown'), time: now() }]);
    } finally {
      setBusy(false);
      scrollBottom();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>🧑‍🌾</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>GAIA Agronomist</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSub}>
              {busy ? 'Thinking…' : recording ? 'Listening…' : 'Online — ready to help'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
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
              <Text
                style={[
                  styles.bubbleText,
                  m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAi,
                ]}
              >
                {m.text}
              </Text>
              <Text
                style={[
                  styles.bubbleTime,
                  m.role === 'user' ? styles.bubbleTimeUser : styles.bubbleTimeAi,
                ]}
              >
                {m.time}
              </Text>
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
              <Text style={styles.thinkingText}>GAIA is thinking…</Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Input bar */}
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
          placeholder={recording ? 'Listening…' : 'Type or tap the mic…'}
          placeholderTextColor={palette.textDim}
          style={styles.input}
          multiline
          editable={!busy && !recording && !transcribing}
          maxLength={1000}
        />

        <Pressable
          onPress={() => send()}
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
    </KeyboardAvoidingView>
  );
}

function now() {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return hr + ':' + m + ' ' + ampm;
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 22 },
  headerTitle: { fontSize: 17, fontWeight: '900', color: p.text, letterSpacing: -0.3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.neon },
  headerSub: { fontSize: 11, color: p.textMuted },

  scroll: { padding: 16, paddingBottom: 20 },

  row: { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },

  smallAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  smallAvatarEmoji: { fontSize: 16 },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleUser: { backgroundColor: p.neon, borderBottomRightRadius: 6 },
  bubbleAi: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderBottomLeftRadius: 6,
  },

  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: p.obsidian, fontWeight: '600' },
  bubbleTextAi: { color: p.text },

  bubbleTime: { fontSize: 9, marginTop: 6, opacity: 0.55 },
  bubbleTimeUser: { color: p.obsidian, textAlign: 'right' },
  bubbleTimeAi: { color: p.textMuted },

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 60, 90, 0.12)',
    borderTopWidth: 1,
    borderTopColor: p.danger,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: p.danger },
  recText: { fontSize: 12, color: p.danger, fontWeight: '600' },
});
