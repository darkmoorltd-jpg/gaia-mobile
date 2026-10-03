import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';
import { MarkdownOutput } from '../../src/components/MarkdownOutput';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const MAX_EDITS = 5;
const MAX_HISTORY_SENT = 40;
const LISTEN_WINDOW_MS = 6500;

type Tab = 'text' | 'image' | 'voice' | 'file' | 'history';
type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface ChatMsg {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  edit_count?: number;
  created_at?: string;
}

interface Session {
  session_id: string;
  preview: string;
  count: number;
  last_at: string;
}

function newSessionId() {
  const s = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 16; i++) out += s[Math.floor(Math.random() * s.length)];
  return 'sess-' + out;
}

function detectLanguage(text: string): string {
  const t = ' ' + text.toLowerCase() + ' ';
  if (/\b(barka|sannu|yaya|ina|nawa|zan|yau|gobe|kadai|dama|toh|nagode|madalla)\b/.test(t)) return 'ha-NG';
  if (/\b(bawo|ore|jowo|pele|abi|eki|eshey|jare|kilode|o da)\b/.test(t)) return 'yo-NG';
  if (/\b(kedu|nnoo|ndewo|gini|bia|nwanne|maka|daalu|ka o di)\b/.test(t)) return 'ig-NG';
  if (/\b(wetin|dey|sabi|chop|waka|shey)\b/.test(t)) return 'en-NG';
  if (/\b(bonjour|merci|oui|salut|comment)\b/.test(t)) return 'fr-FR';
  if (/\b(habari|asante|karibu|kwaheri|jambo|ndiyo)\b/.test(t)) return 'sw-KE';
  return 'en-NG';
}

const STOP_WORDS = [
  'stop','goodbye','bye','exit','end','quit',
  'thank you','thanks','that is all','that is enough','i am done','im done','done','ok thanks','okay thanks',
  'sai anjima','sai an jima','nagode','na gode','ban gajiya',
  'o da bo','o daabo','ese','o se','mo ti de',
  'ka o di','daalu','nnoo',
  'au revoir','merci','arrete','arret',
  'kwaheri','asante',
];

function isStopPhrase(text: string): boolean {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  if (words.length > 8) return false;
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
  const [memBusy, setMemBusy] = useState(false);
  const [memory, setMemory] = useState<Record<string, string>>({});
  const [showMemory, setShowMemory] = useState(false);
  const [editing, setEditing] = useState<{ idx: number; text: string } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsBusy, setSessionsBusy] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [activeConv, setActiveConv] = useState(false);
  const activeRef = useRef(false);
  const msgRef = useRef<ChatMsg[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { msgRef.current = messages; }, [messages]);
  useEffect(() => { loadMemory(); }, [user]);

  const token = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const loadMemory = async () => {
    if (!user) return;
    const t = await token();
    if (!t) return;
    try {
      const r = await fetch(`${API_BASE}/memory`, { headers: { Authorization: `Bearer ${t}` } });
      if (r.ok) { const d = await r.json(); setMemory(d.memory || {}); }
    } catch {}
  };

  const loadSessions = async () => {
    const t = await token();
    if (!t) return;
    setSessionsBusy(true);
    try {
      const r = await fetch(`${API_BASE}/history/sessions`, { headers: { Authorization: `Bearer ${t}` } });
      if (r.ok) { const d = await r.json(); setSessions(d.sessions || []); }
    } catch {}
    setSessionsBusy(false);
  };

  useEffect(() => { if (tab === 'history') loadSessions(); }, [tab]);

  const loadSession = async (sid: string) => {
    const t = await token();
    if (!t) return;
    try {
      const r = await fetch(`${API_BASE}/history/${sid}`, { headers: { Authorization: `Bearer ${t}` } });
      if (r.ok) {
        const d = await r.json();
        setMessages((d.messages || []).map((m: any) => ({
          id: m.id, role: m.role, content: m.content,
          edit_count: m.edit_count, created_at: m.created_at,
        })));
        setSessionId(sid);
        setTab('text');
      }
    } catch {}
  };

  const saveMessage = async (role: string, content: string) => {
    const t = await token();
    if (!t) return null;
    try {
      const r = await fetch(`${API_BASE}/history/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, role, content }),
      });
      if (r.ok) { const d = await r.json(); return d.message?.id || null; }
    } catch {}
    return null;
  };

  const deleteMessage = async (msg: ChatMsg, idx: number) => {
    Alert.alert('Delete message', 'Remove it from your history permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const t = await token();
        if (t && msg.id) {
          try { await fetch(`${API_BASE}/history/message/${msg.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } }); } catch {}
        }
        setMessages((prev) => prev.filter((_, i) => i !== idx));
      }},
    ]);
  };

  const deleteSession = async (sid: string) => {
    Alert.alert('Delete conversation', 'Remove this entire conversation?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const t = await token();
        if (t) {
          try { await fetch(`${API_BASE}/history/session/${sid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } }); } catch {}
        }
        setSessions((prev) => prev.filter((s) => s.session_id !== sid));
        if (sid === sessionId) { setMessages([]); setSessionId(newSessionId()); }
      }},
    ]);
  };

  const beginEdit = (idx: number) => {
    const m = messages[idx];
    if (m.role !== 'user') { Alert.alert('Only your messages can be edited'); return; }
    if ((m.edit_count || 0) >= MAX_EDITS) { Alert.alert('Edit limit reached', 'Up to 5 edits.'); return; }
    setEditing({ idx, text: m.content });
  };

  const commitEdit = async () => {
    if (!editing) return;
    const { idx, text } = editing;
    const m = messages[idx];
    if (!m.id) { setMessages((p) => p.map((x, i) => (i === idx ? { ...x, content: text } : x))); setEditing(null); return; }
    const t = await token();
    if (!t) return;
    setMemBusy(true);
    try {
      const r = await fetch(`${API_BASE}/history/edit/${m.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_content: text }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); Alert.alert('Edit failed', e.error || r.statusText); }
      else {
        const d = await r.json();
        setMessages((p) => p.map((x, i) => (i === idx ? { ...x, content: text, edit_count: d.edit_count } : x)));
        setEditing(null);
      }
    } catch (e: any) {(`${ Alert.alert('Edit failed', e.message || 'TryAPI again'); }
    finally { setMem_BBusy(false); }
  };

  const clearSession = () => {
    Alert.alert('Clear conversation', 'All messages will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const t = await token();
        if (t) { try { await fetch(`${API_BASE}/history/session/${sessionId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } }); } catch {} }
        setMessages([]);
        setSessionId(newSessionId());
      }},
    ]);
  };

  const appendAssistant = async (content: string) => {
    setMessages((prev) => [...prev, { role: 'assistant', content }]);
    const id = await saveMessage('assistant', content);
    if (id) {
      setMessages((prev) => {
        const c = [...prev];
        c[c.length - 1] = { ...c[c.length - 1], id };
        return c;
      });
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  // ============================================================
  // TEXT
  // ============================================================
  const sendText = async () => {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setInput('');
    setEditing(null);
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const t = await token();
      if (!t) throw new Error('Not authenticated');
      const uid = await saveMessage('user', q);
      if (uid) {
        setMessages((prev) => {
          const c = [...prev];
          c[c.length - 1] = { ...c[c.length - 1], id: uid };
          return c;
        });
      }
      const history = msgRef.current.slice(-MAX_HISTORY_SENT).map((m) => ({ role: m.role, content: m.content }));
      const lang = detectLanguage(q);
      const r = await fetch(`${API_BASE}/agronomist/text`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history, language: lang }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      const data = await r.json();
      await appendAssistant(data.answer || data.reply || '(no response)');
    } catch (e: any) {
      Alert.alert('GAIA error', e.message || 'Try again');
      await appendAssistant('Could not reach the server. Please try again.');
    } finally { setBusy(false); }
  };

  // ============================================================
  // IMAGE
  // ============================================================
  const sendImage = async (uri: string) => {
    setBusy(true);
    setMessages((prev) => [...prev, { role: 'user', content: '[Image uploaded]' }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const t = await token();
      if (!t) throw new Error('Not authenticated');
      const question = input.trim() || 'Analyze this farm image and give a full diagnosis and treatment plan.';
      setInput('');
      const up = await FileSystem.uploadAsyncASE}/agronomist/image`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'image',
        mimeType: 'image/jpeg',
        headers: { Authorization: `Bearer ${t}` },
        parameters: { question },
      });
      if (up.status < 200 || up.status >= 300) {
        let m = `HTTP ${up.status}`;
        try { m = JSON.parse(up.body).error || m; } catch {}
        throw new Error(m);
      }
      const data = JSON.parse(up.body || '{}');
      await appendAssistant(data.answer || '(no response)');
    } catch (e: any) {
      Alert.alert('GAIA error', e.message || 'Try again');
      await appendAssistant('Could not analyze the image.');
    } finally { setBusy(false); }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission required'); return; }
    Alert.alert('Add image', 'Choose a source', [
      { text: 'Camera', onPress: async () => {
        const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
        if (!r.canceled) sendImage(r.assets[0].uri);
      }},
      { text: 'Gallery', onPress: async () => {
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true });
        if (!r.canceled) sendImage(r.assets[0].uri);
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ============================================================
  // FILE
  // ============================================================
  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/*', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const f = res.assets[0];
      sendFile(f.uri, f.name, f.mimeType || 'application/octet-stream');
    } catch (e: any) { Alert.alert('File error', e.message); }
  };

  const sendFile = async (uri: string, name: string, mime: string) => {
    setBusy(true);
    setMessages((prev) => [...prev, { role: 'user', content: '[File] ' + name }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const t = await token();
      if (!t) throw new Error('Not authenticated');
      const question = input.trim() || 'Analyze this document and advise me.';
      setInput('');
      const up = await FileSystem.uploadAsync(`${API_BASE}/agronomist/file`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: mime,
        headers: { Authorization: `Bearer ${t}` },
        parameters: { question },
      });
      if (up.status < 200 || up.status >= 300) {
        let m = `HTTP ${up.status}`;
        try { m = JSON.parse(up.body).error || m; } catch {}
        throw new Error(m);
      }
      const data = JSON.parse(up.body || '{}');
      await appendAssistant(data.answer || '(no response)');
    } catch (e: any) {
      Alert.alert('GAIA error', e.message || 'Try again');
      await appendAssistant('Could not process the file.');
    } finally { setBusy(false); }
  };

  // ============================================================
  // VOICE — CONVERSATION LOOP
  // ============================================================
  const startConversation = async () => {
    if (!user) { Alert.alert('Sign in required'); return; }
    if (activeRef.current) return;
    activeRef.current = true;
    setActiveConv(true);
    runConversationLoop();
  };

  const stopConversation = async () => {
    activeRef.current = false;
    setActiveConv(false);
    setVoiceState('idle');
    try { Speech.stop(); } catch {}
    try { await recorder.stop(); } catch {}
    try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch {}
  };

  const recordOneTurn = async (): Promise<string | null> => {
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
      console.log('recordOneTurn failed', e);
      return null;
    }
  };

  const transcribeTurn = async (uri: string): Promise<{ text: string; lang: string }> => {
    const t = await token();
    if (!t) return { text: '', lang: 'en-NG' };
    try {
      const res = await FileSystem.uploadAsync(`${API_BASE}/transcribe`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'audio',
        mimeType: 'audio/m4a',
        headers: { Authorization: `Bearer ${t}` },
        parameters: { language: 'auto' },
      });
      if (res.status < 200 || res.status >= 300) return { text: '', lang: 'en-NG' };
      const data = JSON.parse(res.body || '{}');
      const text = (data.text || '').trim();
      const lang = data.language || detectLanguage(text);
      return { text, lang };
    } catch {
      return { text: '', lang: 'en-NG' };
    }
  };

  const askAI = async (question: string, lang: string): Promise<string> => {
    const t = await token();
    if (!t) return '';
    try {
      const history = msgRef.current.slice(-MAX_HISTORY_SENT).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(`${API_BASE}/agronomist/text`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history, language: lang }),
      });
      if (!res.ok) return '';
      const data = await res.json();
      return data.answer || data.reply || '';
    } catch {
      return '';
    }
  };

  const appendUser = async (content: string) => {
    setMessages((prev) => [...prev, { role: 'user', content }]);
    const id = await saveMessage('user', content);
    if (id) {
      setMessages((prev) => {
        const c = [...prev];
        c[c.length - 1] = { ...c[c.length - 1], id };
        return c;
      });
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const speakReply = async (text: string, lang: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        Speech.stop();
        Speech.speak(text, {
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

  const runConversationLoop = async () => {
    while (activeRef.current) {
      // 1) LISTEN
      setVoiceState('listening');
      const uri = await recordOneTurn();
      if (!activeRef.current) break;
      if (!uri) continue;

      // 2) TRANSCRIBE
      setVoiceState('thinking');
      const { text: transcript, lang } = await transcribeTurn(uri);
      if (!activeRef.current) break;
      if (!transcript) continue;

      await appendUser('(voice) ' + transcript);

      // 3) STOP PHRASE?
      if (isStopPhrase(transcript)) {
        const bye = goodbyeFor(lang);
        const bid = await saveMessage('assistant', bye);
        setMessages((prev) => [...prev, { role: 'assistant', content: bye, id: bid || undefined }]);
        setVoiceState('speaking');
        await speakReply(bye, lang);
        break;
      }

      // 4) ASK AI
      const reply = await askAI(transcript, lang);
      if (!activeRef.current) break;
      const finalReply = reply || 'Sorry, I did not catch that. Please say it again.';
      const aid = await saveMessage('assistant', finalReply);
      setMessages((prev) => [...prev, { role: 'assistant', content: finalReply, id: aid || undefined }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

      // 5) SPEAK
      setVoiceState('speaking');
      await speakReply(finalReply, lang);
    }
    activeRef.current = false;
    setActiveConv(false);
    setVoiceState('idle');
  };

  const onMicPress = () => {
    if (activeConv) stopConversation();
    else startConversation();
  };

  // ============================================================
  // RENDER
  // ============================================================
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
          <Text style={styles.iconText}>*</Text>
        </Pressable>
        <Pressable onPress={clearSession} style={styles.iconBtn} hitSlop={10}>
          <Text style={[styles.iconText, { color: palette.danger }]}>X</Text>
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        {(['text','image','voice','file','history'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'text' ? 'Text' : t === 'image' ? 'Image' : t === 'voice' ? 'Voice' : t === 'file' ? 'File' : 'History'}
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
                onPress={() => loadSession(s.session_id)}
                onLongPress={() => deleteSession(s.session_id)}
                delayLongPress={400}
                style={styles.sessionCard}
              >
                <Text style={styles.sessionPreview} numberOfLines={2}>{s.preview || '(no preview)'}</Text>
                <Text style={styles.sessionMeta}>{s.count} messages - {new Date(s.last_at).toLocaleDateString()}</Text>
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
                Ask in text, upload a photo, or tap Voice to have a full hands-free conversation.
                I remember everything you tell me.
              </Text>
            </View>
          ) : (
            messages.map((m, i) => (
              <Pressable
                key={i}
                onLongPress={() => (m.role === 'user' ? beginEdit(i) : deleteMessage(m, i))}
                style={[styles.row, m.role === 'user' ? styles.rowUser : styles.rowAi]}
              >
                <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
                  {m.role === 'assistant' ? (
                    <MarkdownOutput content={m.content} />
                  ) : (
                    <Text style={styles.bubbleTextUser}>{m.content}</Text>
                  )}
                  {m.role === 'user' && m.edit_count != null && m.edit_count > 0 ? (
                    <Text style={styles.editBadge}>edited - {m.edit_count}/{MAX_EDITS}</Text>
                  ) : null}
                </View>
                <View style={styles.actions}>
                  {m.role === 'user' && (m.edit_count || 0) < MAX_EDITS ? (
                    <Pressable onPress={() => beginEdit(i)} style={styles.actionBtn}>
                      <Text style={styles.actionText}>E</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => deleteMessage(m, i)} style={styles.actionBtn}>
                    <Text style={[styles.actionText, { color: palette.danger }]}>D</Text>
                  </Pressable>
                </View>
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

      {tab !== 'history' && (
        <View style={styles.inputBar}>
          {tab === 'image' && (
            <Pressable onPress={pickImage} style={styles.iconBtn}>
              <Text style={styles.iconText}>Img</Text>
            </Pressable>
          )}
          {tab === 'file' && (
            <Pressable onPress={pickFile} style={styles.iconBtn}>
              <Text style={styles.iconText}>File</Text>
            </Pressable>
          )}
          {tab === 'voice' ? (
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
              {activeConv ? (
                <Text style={styles.voiceHint}>
                  Speak naturally. Say "thank you", "goodbye", or "stop" to end.
                </Text>
              ) : (
                <Text style={styles.voiceHint}>
                  Tap once and GAIA will keep the conversation going hands-free.
                </Text>
              )}
            </View>
          ) : (
            <>
              <TextInput
                value={editing ? editing.text : input}
                onChangeText={(t) => (editing ? setEditing({ ...editing, text: t }) : setInput(t))}
                placeholder={editing ? 'Editing...' : 'Ask GAIA anything...'}
                placeholderTextColor={palette.textDim}
                style={styles.input}
                multiline
              />
              {editing ? (
                <>
                  <Pressable onPress={() => setEditing(null)} style={[styles.sendBtn, { backgroundColor: palette.surface }]}>
                    <Text style={[styles.sendBtnText, { color: palette.text }]}>X</Text>
                  </Pressable>
                  <Pressable onPress={commitEdit} disabled={memBusy} style={styles.sendBtn}>
                    {memBusy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.sendBtnText}>OK</Text>}
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={sendText}
                  disabled={busy || !input.trim()}
                  style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]}
                >
                  <Text style={styles.sendBtnText}>Send</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}

      <Modal visible={showMemory} animationType="slide" transparent onRequestClose={() => setShowMemory(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Memory</Text>
            <Text style={styles.modalSub}>Facts GAIA remembers about you</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {Object.entries(memory).length === 0 ? (
                <Text style={styles.emptyText}>Nothing yet.</Text>
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
  iconBtn: { minWidth: 36, height: 36, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 16, color: palette.text, fontWeight: '800' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.neon },
  headerTitle: { ...typography.body, color: palette.text, fontWeight: '800' },

  tabBar: {
    flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: palette.border,
    backgroundColor: palette.obsidian,
  },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 11, color: palette.textDim, fontWeight: '700' },
  tabTextActive: { color: palette.neon },

  scroll: { padding: 16, paddingBottom: 20 },
  empty: { padding: 30, alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: palette.text, marginBottom: 10 },
  emptyText: { fontSize: 14, color: palette.textMuted, textAlign: 'center', lineHeight: 22 },
  row: { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end' },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '86%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: { backgroundColor: palette.neon, borderBottomRightRadius: 6 },
  bubbleAi: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderBottomLeftRadius: 6 },
  bubbleTextUser: { fontSize: 15, lineHeight: 22, color: palette.obsidian, fontWeight: '600' },
  editBadge: { fontSize: 10, color: 'rgba(0,0,0,0.55)', marginTop: 4, fontStyle: 'italic' },
  actions: { flexDirection: 'row', marginLeft: 6, gap: 4 },
  actionBtn: { padding: 6 },
  actionText: { fontSize: 14, fontWeight: '800', color: palette.textMuted },

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
