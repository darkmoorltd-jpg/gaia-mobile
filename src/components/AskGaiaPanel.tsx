import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, typography, spacing, radius } from '../theme';
import { useAuth } from '../store/auth';
import { supabase } from '../api/supabase';
import { MarkdownOutput } from './MarkdownOutput';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const LISTEN_WINDOW_MS = 6500;

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  disease: string;
  cropLabel: string;
  contextType: string;   // 'crop' | 'pest' | 'soil' | 'livestock'
  confidence?: number;
}

export default function AskGaiaPanel({ disease, cropLabel, contextType, confidence }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const token = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const buildContext = () => {
    const head = `Context: The farmer just had a GAIA ${contextType} diagnosis. `;
    const detail = `Subject: ${cropLabel || 'unknown'}. Detected condition: ${disease}` +
      (confidence ? ` (${confidence.toFixed(1)}% confidence).` : '.');
    return head + detail + ' Answer follow-up questions with the same bold, specific, Nigerian-field-officer style. Give Naira costs and exact product names.';
  };

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const q = question.trim();
    setInput('');
    setTurns((prev) => [...prev, { role: 'user', content: q }]);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const t = await token();
      if (!t) throw new Error('Not authenticated');
      const history = [
        { role: 'system', content: buildContext() },
        ...turns.slice(-6).map((x) => ({ role: x.role, content: x.content })),
      ];
      const r = await fetch(`${API_BASE}/agronomist/text`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const answer = data.answer || data.reply || '(no response)';
      setTurns((prev) => [...prev, { role: 'assistant', content: answer }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (e: any) {
      Alert.alert('GAIA error', e.message || 'Try again');
      setTurns((prev) => [...prev, { role: 'assistant', content: '_Could not reach GAIA. Please try again._' }]);
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('Microphone permission required'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e: any) {
      Alert.alert('Recording error', e.message);
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      if (!uri) return;
      setBusy(true);
      const t = await token();
      if (!t) throw new Error('Not authenticated');
      const up = await FileSystem.uploadAsync(`${API_BASE}/agronomist/audio`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'audio',
        mimeType: 'audio/m4a',
        headers: { Authorization: `Bearer ${t}` },
      });
      if (up.status < 200 || up.status >= 300) throw new Error(`HTTP ${up.status}`);
      const data = JSON.parse(up.body || '{}');
      if (data.transcript) {
        setTurns((prev) => [...prev, { role: 'user', content: '🎤 ' + data.transcript }]);
      }
      if (data.answer) {
        setTurns((prev) => [...prev, { role: 'assistant', content: data.answer }]);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (e: any) {
      Alert.alert('Voice error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.head}>ASK GAIA ABOUT THIS</Text>
      <Text style={styles.sub}>
        Follow-up questions on <Text style={{ color: palette.neon, fontWeight: '800' }}>{disease}</Text>
      </Text>

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
          <Text style={styles.hint}>
            Try asking:
          </Text>
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
          <Pressable
            onPressIn={startRecording}
            onPressOut={stopRecording}
            style={[styles.micBtn, recording && styles.micBtnOn]}
          >
            <Text style={styles.micText}>{recording ? '● REC' : '🎤'}</Text>
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask GAIA anything about this..."
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
    marginTop: 24,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(0,255,136,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.25)',
  },
  head: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  sub: { fontSize: 12, color: '#fff', marginTop: 4, marginBottom: 12 },
  history: { maxHeight: 420 },
  row: { flexDirection: 'row', marginBottom: 10 },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '90%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  bubbleUser: { backgroundColor: p.neon, borderBottomRightRadius: 4 },
  bubbleAi: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: p.border,
    borderBottomLeftRadius: 4,
  },
  userText: { fontSize: 14, color: p.obsidian, fontWeight: '600', lineHeight: 20 },
  hintBox: { paddingVertical: 8 },
  hint: { fontSize: 11, color: p.textMuted, marginBottom: 8, letterSpacing: 1 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: p.border,
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginBottom: 6,
  },
  chipText: { fontSize: 12, color: '#fff' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12,
  },
  micBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1, borderColor: p.border,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnOn: { backgroundColor: '#ff3b5c', borderColor: '#ff3b5c' },
  micText: { fontSize: 14, color: '#fff', fontWeight: '900' },
  input: {
    flex: 1, minHeight: 48, maxHeight: 120,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: p.border,
    color: '#fff', fontSize: 14,
  },
  sendBtn: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24,
    backgroundColor: p.neon, minWidth: 64,
    alignItems: 'center', justifyContent: 'center',
  },
  sendText: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
