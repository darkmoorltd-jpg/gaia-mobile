import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';
import { MarkdownOutput } from '../../src/components/MarkdownOutput';
import { speak as speakSmart } from '../../src/utils/voice';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const MAX_HISTORY_SENT = 40;
const LISTEN_WINDOW_MS = 6500;

type Tab = 'text' | 'voice' | 'history';
type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface ChatMsg {
  msg_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface SessionRow {
  session_id: string;
  preview: string;
  count: number;
  updated_at: string;
}

function newSessionId() {
  const s = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 16; i++) out += s[Math.floor(Math.random() * s.length)];
  return 'sess-' + out;
}

function newMsgId() {
  return 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function detectLanguage(text: string): string {
  const t = ' ' + text.toLowerCase() + ' ';
  if (/\b(barka|sannu|yaya|ina|nawa|zan|yau|gobe|kadai|dama|toh|nagode|madalla)\b/.test(t)) return 'ha-NG';
  if (/\b(bawo|ore|jowo|pele|abi|eki|eshey|jare|kilode)\b/.test(t)) return 'yo-NG';
  if (/\b(kedu|nnoo|ndewo|gini|bia|nwanne|maka|daalu)\b/.test(t)) return 'ig-NG';
  if (/\b(wetin|dey|sabi|chop|waka|shey)\b/.test(t)) return 'en-NG';
  if (/\b(bonjour|merci|oui|salut|comment)\b/.test(t)) return 'fr-FR';
  if (/\b(habari|asante|karibu|kwaheri|jambo|ndiyo)\b/.test(t)) return 'sw-KE';
  return 'en-NG';
}

const STOP_WORDS = [
  'stop', 'goodbye', 'bye', 'exit', 'end', 'quit',
  'thank you', 'thanks', 'that is all', 'that is enough',
  'i am done', 'im done', 'done', 'ok thanks', 'okay thanks',
  'sai anjima', 'sai an jima', 'nagode', 'na gode',
  'o da bo', 'o daabo', 'ese', 'o se',
  'ka o di', 'daalu', 'nnoo',
  'au revoir', 'merci', 'arrete',
  'kwaheri', 'asante',
];

function isStopPhrase(text: string): boolean {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) return false;
  const l = words.join(' ');
  return STOP_WORDS.some((w) => l === w || l.endsWith(' ' + w) || l === w + '.');
}

function goodbyeFor(lang: string): string {
  if (lang.startsWith('ha')) return 'Sai anjima.';
  if (lang.startsWith('yo')) return 'O da bo.';
  if (lang.startsWith('ig')) return 'Ka o di.';
  if (lang.startsWith('fr')) return 'Au revoir.';
  if (lang.startsWith('sw')) return 'Kwaheri.';
  return 'Goodbye. Talk to you soon.';
}

export default function Voice() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [tab, setTab] = useState<Tab>('text');
  const [sessionId, setSessionId] = useState<string>(newSessionId());
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [memory, setMemory] = useState<Record<string, string>>({});

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [activeConv, setActiveConv] = useState(false);
  const activeRef = useRef(false);
  const msgRef = useRef<ChatMsg[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { msgRef.current = messages; }, [messages]);

  // ---- load memory ----
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('agronomist_memory')
          .select('key,value')
          .eq('user_id', user.id);
        const m: Record<string, string> = {};
        (data || []).forEach((r: any) => { m[r.key] = r.value; });
        setMemory(m);
      } catch {}
    })();
  }, [user]);

  // ---- persistence ----
  const persistSession = async (msgs: ChatMsg[]) => {
    if (!user) return;
    try {
      await supabase.from('agronomist_sessions').upsert(
        {
          user_id: user.id,
          session_id: sessionId,
          messages: msgs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,session_id' },
      );
    } catch (e) {
      console.log('persist failed', e);
    }
  };

  const appendMsg = async (role: 'user' | 'assistant', content: string) => {
    const msg: ChatMsg = {
      msg_id: newMsgId(),
      role,
      content,
      created_at: new Date().toISOString(),
    };
    const next = [...msgRef.current, msg];
    setMessages(next);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    await persistSession(next);
    return msg;
  };

  const deleteMessage = (idx: number) => {
    Alert.alert('Delete message', 'Remove from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const next = messages.filter((_, i) => i !== idx);
          setMessages(next);
          await persistSession(next);
        },
      },
    ]);
  };

  // ---- history tab ----
  const loadSessions = async () => {
    if (!user) return;
    setSessionsBusy(true);
    try {
      const { data } = await supabase
        .from('agronomist_sessions')
        .select('session_id,messages,updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50);
      const rows: SessionRow[] = (data || []).map((r: any) => {
        const msgs = Array.isArray(r.messages) ? r.messages : [];
        const first = msgs.find((m: any) => m.role === 'user');
        return {
          session_id: r.session_id,
          preview: first?.content?.slice(0, 80) || '(empty)',
          count: msgs.length,
          updated_at: r.updated_at,
        };
      });
      setSessions(rows);
    } catch {}
    setSessionsBusy(false);
  };

  useEffect(() => { if (tab === 'history') loadSessions(); }, [tab]);

  const openSession = async (sid: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('agronomist_sessions')
      .select('messages')
      .eq('user_id', user.id)
      .eq('session_id', sid)
      .maybeSingle();
    const msgs = (data?.messages as ChatMsg[]) || [];
    setMessages(msgs);
    setSessionId(sid);
    setTab('text');
  };

  const deleteSession = (sid: string) => {
    Alert.alert('Delete conversation', 'Remove this entire conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await supabase
            .from('agronomist_sessions')
            .delete()
            .eq('user_id', user.id)
            .eq('session_id', sid);
          setSessions((prev) => prev.filter((s) => s.session_id !== sid));
          if (sid === sessionId) {
            setMessages([]);
            setSessionId(newSessionId());
          }
        },
      },
    ]);
  };

  const clearSession = () => {
    Alert.alert('Clear conversation', 'Delete all messages in this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (user) {
            await supabase
              .from('agronomist_sessions')
              .delete()
              .eq('user_id', user.id)
              .eq('session_id', sessionId);
          }
          setMessages([]);
          setSessionId(newSessionId());
        },
      },
    ]);
  };

  // ---- ask AI (uses /chat) ----
  const askAI = async (question: string, lang: string): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const t = session?.access_token;
    if (!t) return '';
    try {
      const history = msgRef.current
        .slice(-MAX_HISTORY_SENT)
        .map((m) => ({ role: m.role, content: m.content }));
      const r = await fetch(API_BASE + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ message: question, language: lang, history }),
      });
      if (!r.ok) return '';
      const d = await r.json();
      return d.reply || d.answer || '';
    } catch {
      return '';
    }
  };

  // ---- text tab ----
  const sendText = async () => {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setInput('');
    setBusy(true);
    try {
      await appendMsg('user', q);
      const lang = detectLanguage(q);
      const reply = await askAI(q, lang);
      await appendMsg('assistant', reply || 'Sorry, I could not reach the server.');
    } catch (e: any) {
      Alert.alert('GAIA error', e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  // ---- voice loop ----
  const startConversation = async () => {
    if (!user) { Alert.alert('Sign in required'); return; }
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

  const transcribeTurn = async (uri: string): Promise<{ text: string; lang: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const t = session?.access_token;
    if (!t) return { text: '', lang: 'en-NG' };
    try {
      const res = await FileSystem.uploadAsync(API_BASE + '/stt', uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'audio',
        mimeType: 'audio/m4a',
        headers: { Authorization: 'Bearer ' + t }
      });
      if (res.status < 200 || res.status >= 300) return { text: '', lang: 'en-NG' };
      const d = JSON.parse(res.body || '{}');
      const text = (d.text || '').trim();
      return { text, lang: detectLanguage(text) };
    } catch {
      return { text: '', lang: 'en-NG' };
    }
  };

  const speak = async (text: string, lang: string): Promise<void> => {
    // speakSmart tries the backend /tts (native Nigerian voices) first,
    // then falls back to device Speech.speak with the best matching voice.
    try {
      await speakSmart(text, lang);
    } catch {
      try { Speech.stop(); } catch {}
    }
  };

  const runLoop = async () => {
    while (activeRef.current) {
      setVoiceState('listening');
      const uri = await recordTurn();
      if (!activeRef.current) break;
      if (!uri) continue;

      setVoiceState('thinking');
      const { text, lang } = await transcribeTurn(uri);
      if (!activeRef.current) break;
      if (!text) continue;

      await appendMsg('user', '(voice) ' + text);

      if (isStopPhrase(text)) {
        const bye = goodbyeFor(lang);
        await appendMsg('assistant', bye);
        setVoiceState('speaking');
        await speak(bye, lang);
        break;
      }

      const reply = await askAI(text, lang);
      const finalReply = reply || 'Sorry, I did not catch that. Please say it again.';
      await appendMsg('assistant', finalReply);

      setVoiceState('speaking');
      await speak(finalReply, lang);
    }
    activeRef.current = false;
    setActiveConv(false);
    setVoiceState('idle');
  };

  const onMicPress = () => { if (activeConv) stopConversation(); else startConversation(); };

  const statusLabel =
    voiceState === 'listening' ? 'Listening...'
    : voiceState === 'thinking' ? 'Thinking...'
    : voiceState === 'speaking' ? 'Speaking...'
    : 'Tap to start';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Text style={styles.iconText}>{'<'}</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.dot} />
          <Text style={styles.headerTitle}>GAIA Agronomist</Text>
        </View>
        <Pressable onPress={() => setShowMemory(true)} style={styles.iconBtn} hitSlop={10}>
          <Text style={styles.iconText}>MEM</Text>
        </Pressable>
        <Pressable onPress={clearSession} style={styles.iconBtn} hitSlop={10}>
          <Text style={[styles.iconText, { color: palette.danger }]}>CLR</Text>
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        {(['text', 'voice', 'history'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'text' ? 'Text' : t === 'voice' ? 'Voice' : 'History'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'history' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {sessionsBusy ? (
            <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} />
          ) : sessions.length === 0 ? (
            <Text style={styles.emptyText}>No conversations yet.</Text>
          ) : (
            sessions.map((s) => (
              <Pressable
                key={s.session_id}
                onPress={() => openSession(s.session_id)}
                onLongPress={() => deleteSession(s.session_id)}
                delayLongPress={400}
                style={styles.sessionCard}
              >
                <Text style={styles.sessionPreview} numberOfLines={2}>{s.preview}</Text>
                <Text style={styles.sessionMeta}>{s.count} messages - {new Date(s.updated_at).toLocaleDateString()}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Hello, I am GAIA.</Text>
              <Text style={styles.emptyText}>
                Type a question, or tap Voice to have a hands-free conversation.
                I remember everything you tell me.
              </Text>
            </View>
          ) : (
            messages.map((m, i) => (
              <Pressable
                key={m.msg_id}
                onLongPress={() => deleteMessage(i)}
                delayLongPress={350}
                style={[styles.row, m.role === 'user' ? styles.rowUser : styles.rowAi]}
              >
                <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
                  {m.role === 'assistant' ? (
                    <MarkdownOutput content={m.content} />
                  ) : (
                    <Text style={styles.bubbleTextUser}>{m.content}</Text>
                  )}
                </View>
                <Pressable onPress={() => deleteMessage(i)} style={styles.actionBtn}>
                  <Text style={[styles.actionText, { color: palette.danger }]}>X</Text>
                </Pressable>
              </Pressable>
            ))
          )}
          {busy ? (
            <View style={[styles.row, styles.rowAi]}>
              <View style={[styles.bubble, styles.bubbleAi]}>
                <ActivityIndicator color={palette.neon} size="small" />
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {tab === 'voice' ? (
        <View style={styles.inputBar}>
          <View style={styles.voiceWrap}>
            <Pressable
              onPress={onMicPress}
              style={[
                styles.micBtn,
                activeConv && styles.micBtnActive,
                voiceState === 'listening' && styles.micBtnListening,
                voiceState === 'speaking' && styles.micBtnSpeaking,
              ]}
            >
              {voiceState === 'thinking' ? (
                <ActivityIndicator color={palette.obsidian} />
              ) : (
                <Text style={styles.micGlyph}>{activeConv ? 'STOP' : 'MIC'}</Text>
              )}
            </Pressable>
            <Text style={styles.voiceStatus}>{statusLabel}</Text>
            <Text style={styles.voiceHint}>
              {activeConv
                ? 'Speak naturally. Say "thank you", "goodbye", or "stop" to end.'
                : 'Tap once and GAIA will keep the conversation going hands-free.'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask GAIA anything..."
            placeholderTextColor={palette.textDim}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={sendText}
            disabled={busy || !input.trim()}
            style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={showMemory} animationType="slide" transparent onRequestClose={() => setShowMemory(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Memory</Text>
            <Text style={styles.modalSub}>Facts GAIA remembers about you</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {Object.entries(memory).length === 0 ? (
                <Text style={styles.emptyText}>Nothing yet. Tell GAIA about yourself in a chat.</Text>
              ) : (
                Object.entries(memory).map(([k, v]) => (
                  <View key={k} style={styles.memoryRow}>
                    <Text style={styles.memoryKey}>{k}</Text>
                    <Text style={styles.memoryVal}>{v}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable onPress={() => setShowMemory(false)} style={[styles.modalBtn, styles.modalBtnGhost]}>
              <Text style={styles.modalBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingTop: 60, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: palette.border, gap: 6,
  },
  iconBtn: { minWidth: 40, height: 36, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 11, color: palette.text, fontWeight: '800', letterSpacing: 1 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.neon },
  headerTitle: { ...typography.body, color: palette.text, fontWeight: '800' },

  tabBar: {
    flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: palette.border,
    backgroundColor: palette.obsidian,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 12, color: palette.textDim, fontWeight: '700' },
  tabTextActive: { color: palette.neon },

  scroll: { padding: 16, paddingBottom: 20 },
  empty: { padding: 30, alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: palette.text, marginBottom: 10 },
  emptyText: { fontSize: 14, color: palette.textMuted, textAlign: 'center', lineHeight: 22 },
  row: { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end' },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: { backgroundColor: palette.neon, borderBottomRightRadius: 6 },
  bubbleAi: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderBottomLeftRadius: 6 },
  bubbleTextUser: { fontSize: 15, lineHeight: 22, color: palette.obsidian, fontWeight: '600' },
  actionBtn: { padding: 8, marginLeft: 4 },
  actionText: { fontSize: 12, fontWeight: '900' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: palette.border,
    backgroundColor: palette.obsidian,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 140,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border,
    color: palette.text, fontSize: 15,
  },
  sendBtn: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22,
    backgroundColor: palette.neon, minWidth: 60,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { fontSize: 13, fontWeight: '900', color: palette.obsidian, letterSpacing: 1 },

  voiceWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  micBtn: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.neon,
    borderWidth: 4, borderColor: 'rgba(0,255,136,0.25)',
  },
  micBtnActive: { backgroundColor: palette.surface, borderColor: palette.neon },
  micBtnListening: { backgroundColor: palette.neon, borderColor: 'rgba(0,255,136,0.6)' },
  micBtnSpeaking: { backgroundColor: palette.warning, borderColor: 'rgba(255,190,0,0.5)' },
  micGlyph: { fontSize: 16, fontWeight: '900', color: palette.obsidian, letterSpacing: 2 },
  voiceStatus: { marginTop: 12, fontSize: 14, fontWeight: '800', color: palette.neon, letterSpacing: 1 },
  voiceHint: { marginTop: 6, fontSize: 11, color: palette.textMuted, textAlign: 'center', paddingHorizontal: 20 },

  sessionCard: {
    padding: 14, borderRadius: radius.md,
    backgroundColor: palette.surface, marginBottom: 10,
    borderWidth: 1, borderColor: palette.border,
  },
  sessionPreview: { ...typography.body, color: palette.text, fontWeight: '600' },
  sessionMeta: { ...typography.micro, color: palette.textMuted, marginTop: 6 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: palette.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, borderTopWidth: 1, borderColor: palette.borderHi,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: palette.text },
  modalSub: { ...typography.micro, color: palette.textMuted, marginTop: 4, marginBottom: spacing.lg },
  modalBtn: {
    paddingVertical: 16, borderRadius: radius.md,
    backgroundColor: palette.neon, alignItems: 'center', marginTop: spacing.md,
  },
  modalBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.borderHi },
  modalBtnText: { fontSize: 14, fontWeight: '900', color: palette.obsidian, letterSpacing: 1 },
  memoryRow: {
    padding: 12, borderRadius: 10,
    backgroundColor: palette.surface, marginBottom: 6,
    borderWidth: 1, borderColor: palette.border,
  },
  memoryKey: { ...typography.micro, color: palette.neon },
  memoryVal: { ...typography.body, color: palette.text, marginTop: 4 },
});
