import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { useTheme, typography, spacing, radius } from '../theme';
import { useAuth } from '../store/auth';
import { supabase } from '../api/supabase';
import { MarkdownOutput } from './MarkdownOutput';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const LISTEN_WINDOW_MS = 6500;

const STOP_WORDS = [
  'stop','goodbye','bye','exit','end','quit','thank you','thanks',
  'that is all','that is enough','i am done','im done','done',
  'ok thanks','okay thanks','sai anjima','nagode','o da bo','ese','ka o di','daalu',
  'au revoir','merci','kwaheri','asante',
];

function isStopPhrase(text: string): boolean {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) return false;
  const l = words.join(' ');
  return STOP_WORDS.some((w) => l === w || l.endsWith(' ' + w));
}

function detectLanguage(text: string): string {
  const t = ' ' + text.toLowerCase() + ' ';
  if (/\b(barka|sannu|yaya|ina|nawa|zan|yau|gobe|nagode|madalla)\b/.test(t)) return 'ha-NG';
  if (/\b(bawo|ore|jowo|pele|abi|eki|eshey|jare|kilode)\b/.test(t)) return 'yo-NG';
  if (/\b(kedu|nnoo|ndewo|gini|bia|nwanne|daalu)\b/.test(t)) return 'ig-NG';
  if (/\b(wetin|dey|sabi|chop|waka|shey)\b/.test(t)) return 'en-NG';
  return 'en-NG';
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  disease: string;
  cropLabel: string;
  contextType: string;
  confidence?: number;
}

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function AskGaiaPanel({ disease, cropLabel, contextType, confidence }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [activeConv, setActiveConv] = useState(false);
  const activeRef = useRef(false);
  const turnsRef = useRef<Turn[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => { turnsRef.current = turns; }, [turns]);

  const token = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const buildContext = () => {
    return `Context: The farmer just had a GAIA ${contextType} diagnosis. ` +
      `Subject: ${cropLabel || 'unknown'}. Detected condition: ${disease}` +
      (confidence ? ` (${confidence.toFixed(1)}% confidence).` : '.') +
      ' Answer follow-up questions with the same bold, specific, Nigerian-field-officer style. ' +
      'Give Naira costs and exact product names. Keep answers under 300 words unless asked for details.';
  };

  const ask = async (question: string, opts?: { speak?: boolean }) => {
    if (!question.trim() || busy) return null;
    const q = question.trim();
    setInput('');
    setTurns((prev) => [...prev, { role: 'user', content: q }]);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    let answerText = '';
    try {
      const t = await token();
      if (!t) throw new Error('Not authenticated');
      const history = [
        { role: 'system', content: buildContext() },
        ...turnsRef.current.slice(-6).map((x) => ({ role: x.role, content: x.content })),
      ];
      const r = await fetch(`${API_BASE}/agronomist/text`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      answerText = data.answer || data.reply || '(no response)';
      setTurns((prev) => [...prev, { role: 'assistant', content: answerText }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);

      if (opts?.speak) {
        setVoiceState('speaking');
        await speakText(answerText, detectLanguage(q));
        if (activeRef.current) setVoiceState('listening');
      }
    } catch (e: any) {
      Alert.alert('GAIA error', e.message || 'Try again');
      setTurns((prev) => [...prev, { role: 'assistant', content: '_Could not reach GAIA. Please try again._' }]);
    } finally {
      setBusy(false);
    }
    return answerText;
  };

  const speakText = (text: string, lang: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        // strip markdown before speaking so it doesn't say "asterisk asterisk"
        const clean = text
          .replace(/[#*_`>]/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/\|/g, ' ')
          .slice(0, 1200);
        Speech.stop();
        Speech.speak(clean, {
          language: lang,
          pitch: 1.0,
          rate: 0.96,
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: () => resolve(),
        });
      } catch { resolve(); }
    });
  };

  // ============================================================
  // Conversation loop
  // ============================================================
  const startConversation = async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    setActiveConv(true);
    runLoop();
  };

  const stopConversation = async () => {
    activeRef.current = false;
    setActiveConv(false);
    setVoiceState('idle');
    try { Speech.stop(); } catch {}
    try { await recorder.stop(); } catch {}
    try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch {}
  };

  const recordTurn = async (): Promise<string | null> => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('Microphone permission required'); return null; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      const started = Date.now();
      while (activeRef.current && Date.now() - started < LISTEN_WINDOW_MS) {
        await new Promise((r) => setTimeout(r, 200));
      }
      try { await recorder.stop(); } catch {}
      const uri = recorder.uri || null;
      try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch {}
      return uri;
    } catch (e) {
      console.log('record failed', e);
      return null;
    }
  };

  const transcribeTurn = async (uri: string): Promise<{ text: string; answer: string }> => {
    const t = await token();
    if (!t) return { text: '', answer: '' };
    try {
      const up = await FileSystem.uploadAsync(`${API_BASE}/agronomist/audio`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'audio',
        mimeType: 'audio/m4a',
        headers: { Authorization: `Bearer ${t}` },
      });
      if (up.status < 200 || up.status >= 300) return { text: '', answer: '' };
      const d = JSON.parse(up.body || '{}');
      return { text: (d.transcript || '').trim(), answer: d.answer || '' };
    } catch {
      return { text: '', answer: '' };
    }
  };

  const runLoop = async () => {
    while (activeRef.current) {
      setVoiceState('listening');
      const uri = await recordTurn();
      if (!activeRef.current) break;
      if (!uri) continue;

      setVoiceState('thinking');
      const { text, answer } = await transcribeTurn(uri);
      if (!activeRef.current) break;
      if (!text) continue;

      setTurns((prev) => [...prev, { role: 'user', content: '🎤 ' + text }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

      if (isStopPhrase(text)) {
        const bye = 'Goodbye. Talk to you soon.';
        setTurns((prev) => [...prev, { role: 'assistant', content: bye }]);
        setVoiceState('speaking');
        await speakText(bye, detectLanguage(text));
        break;
      }

      if (answer) {
        setTurns((prev) => [...prev, { role: 'assistant', content: answer }]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        setVoiceState('speaking');
        await speakText(answer, detectLanguage(text));
      } else {
        setVoiceState('thinking');
        await ask(text, { speak: true });
      }
    }
    activeRef.current = false;
    setActiveConv(false);
    setVoiceState('idle');
  };

  // ============================================================
  // Manual voice (mic tap, one-shot)
  // ============================================================
  const micPress = async () => {
    if (activeConv) {
      stopConversation();
      return;
    }
    startConversation();
  };

  const statusLabel =
    voiceState === 'listening' ? 'Listening...'
    : voiceState === 'thinking' ? 'Thinking...'
    : voiceState === 'speaking' ? 'Speaking...'
    : 'Tap mic to talk with GAIA';

  return (
    <View style={styles.wrap}>
      <Text style={styles.head}>ASK GAIA ABOUT THIS</Text>
      <Text style={styles.sub}>
        Follow-up questions on <Text style={{ color: palette.neon, fontWeight: '800' }}>{disease}</Text>
      </Text>

      {/* Big conversation button */}
      <Pressable
        onPress={micPress}
        style={[
          styles.talkBtn,
          voiceState === 'listening' && styles.talkBtnListening,
          voiceState === 'speaking' && styles.talkBtnSpeaking,
        ]}
      >
        {voiceState === 'thinking' ? (
          <ActivityIndicator color={palette.obsidian} />
        ) : (
          <>
            <Text style={styles.talkIcon}>{activeConv ? '⏸' : '🎤'}</Text>
            <Text style={styles.talkLabel}>{activeConv ? 'STOP' : 'TALK'}</Text>
          </>
        )}
      </Pressable>
      <Text style={styles.talkStatus}>{statusLabel}</Text>
      {activeConv ? (
        <Text style={styles.talkHint}>
          Speak freely. GAIA will answer and keep listening.
          Say "thank you" or "stop" to end.
        </Text>
      ) : (
        <Text style={styles.talkHint}>
          Tap TALK once for a full hands-free conversation — speak, GAIA answers out loud, then you speak again.
        </Text>
      )}

      {turns.length > 0 ? (
        <ScrollView
          ref={scrollRef}
          style={styles.history}
          contentContainerStyle={{ paddingVertical: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {turns.map((t, i) => (
            <View key={i} style={[styles.row, t.role === 'user' ? styles.rowUser : styles.rowAi]}>
              <View style={[styles.bubble, t.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
                {t.role === 'assistant' ? (
                  <MarkdownOutput content={t.content} />
                ) : (
                  <Text style={styles.userText}>{t.content}</Text>
                )}
              </View>
            </View>
          ))}
          {busy ? (
            <View style={[styles.row, styles.rowAi]}>
              <View style={[styles.bubble, styles.bubbleAi]}>
                <ActivityIndicator color={palette.neon} size="small" />
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.hintBox}>
          <Text style={styles.hint}>Or try asking:</Text>
          {[
            'How much will this cost me?',
            'What if I cannot afford chemicals?',
            'Will it spread to my other crops?',
            'When should I harvest if I cannot treat it?',
          ].map((s) => (
            <Pressable key={s} onPress={() => ask(s)} style={styles.chip}>
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Or type a question..."
            placeholderTextColor={palette.textDim}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={() => ask(input)}
            disabled={busy || !input.trim()}
            style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]}
          >
            <Text style={styles.sendText}>SEND</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  wrap: {
    marginTop: 24, padding: 16, borderRadius: 20,
    backgroundColor: 'rgba(0,255,136,0.04)',
    borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)',
  },
  head: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  sub: { fontSize: 12, color: '#fff', marginTop: 4, marginBottom: 14 },
  talkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingVertical: 20, borderRadius: 20,
    backgroundColor: p.neon,
  },
  talkBtnListening: { backgroundColor: '#00c853' },
  talkBtnSpeaking: { backgroundColor: '#ffb300' },
  talkIcon: { fontSize: 28 },
  talkLabel: { fontSize: 18, fontWeight: '900', color: p.obsidian, letterSpacing: 3 },
  talkStatus: {
    fontSize: 13, fontWeight: '800', color: p.neon,
    textAlign: 'center', marginTop: 10, letterSpacing: 1,
  },
  talkHint: {
    fontSize: 11, color: p.textMuted,
    textAlign: 'center', marginTop: 6, marginBottom: 12, lineHeight: 16,
    paddingHorizontal: 8,
  },
  history: { maxHeight: 420 },
  row: { flexDirection: 'row', marginBottom: 10 },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '90%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  bubbleUser: { backgroundColor: p.neon, borderBottomRightRadius: 4 },
  bubbleAi: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: p.border, borderBottomLeftRadius: 4,
  },
  userText: { fontSize: 14, color: p.obsidian, fontWeight: '600', lineHeight: 20 },
  hintBox: { paddingVertical: 8 },
  hint: { fontSize: 11, color: p.textMuted, marginBottom: 8, letterSpacing: 1 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: p.border,
    backgroundColor: 'rgba(0,0,0,0.4)', marginBottom: 6,
  },
  chipText: { fontSize: 12, color: '#fff' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12,
  },
  input: {
    flex: 1, minHeight: 48, maxHeight: 120,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: p.border, color: '#fff', fontSize: 14,
  },
  sendBtn: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24,
    backgroundColor: p.neon, minWidth: 64,
    alignItems: 'center', justifyContent: 'center',
  },
  sendText: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
