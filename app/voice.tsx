import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, typography, spacing, radius, shadows } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const MAX_EDITS = 5;
const MAX_HISTORY_SENT = 40;

interface ChatMsg {
  id?: number;         // server id once saved
  role: 'user' | 'assistant';
  content: string;
  edit_count?: number;
  created_at?: string;
}

function newSessionId() {
  const s = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 16; i++) out += s[Math.floor(Math.random() * s.length)];
  return 'sess-' + out;
}

export default function Voice() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [sessionId, setSessionId] = useState<string>(newSessionId());
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [memBusy, setMemBusy] = useState(false);
  const [memory, setMemory] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [editing, setEditing] = useState<{ idx: number; text: string } | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // ── Load memory on mount ──
  useEffect(() => {
    loadMemory();
  }, [user]);

  const loadMemory = async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const r = await fetch(`${API_BASE}/memory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setMemory(d.memory || {});
      }
    } catch {}
  };

  const loadSession = async (sid: string) => {
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/history/${sid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setMessages(
          (d.messages || []).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            edit_count: m.edit_count,
            created_at: m.created_at,
          }))
        );
      }
    } catch {}
  };

  // ── Save a message to Supabase ──
  const saveMessage = async (role: string, content: string): Promise<number | null> => {
    if (!user) return null;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;
    try {
      const r = await fetch(`${API_BASE}/history/save`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId, role, content }),
      });
      if (r.ok) {
        const d = await r.json();
        return d.message?.id || null;
      }
    } catch {}
    return null;
  };

  // ── Delete a single message ──
  const deleteMessage = async (msg: ChatMsg, idx: number) => {
    Alert.alert(
      'Delete message',
      'This will remove the message from your history permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (token && msg.id) {
              try {
                await fetch(`${API_BASE}/history/message/${msg.id}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                });
              } catch {}
            }
            setMessages((prev) => prev.filter((_, i) => i !== idx));
          },
        },
      ]
    );
  };

  // ── Edit a user message (≤5 times) ──
  const beginEdit = (idx: number) => {
    const m = messages[idx];
    if (m.role !== 'user') {
      Alert.alert('Only your messages can be edited');
      return;
    }
    if ((m.edit_count || 0) >= MAX_EDITS) {
      Alert.alert('Edit limit reached', 'You can edit a message up to 5 times.');
      return;
    }
    setEditing({ idx, text: m.content });
  };

  const commitEdit = async () => {
    if (!editing) return;
    const { idx, text } = editing;
    const m = messages[idx];
    if (!m.id) {
      setMessages((prev) => prev.map((x, i) => (i === idx ? { ...x, content: text } : x)));
      setEditing(null);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setMemBusy(true);
    try {
      const r = await fetch(`${API_BASE}/history/edit/${m.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ new_content: text }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        Alert.alert('Edit failed', err.error || r.statusText);
      } else {
        const d = await r.json();
        setMessages((prev) =>
          prev.map((x, i) =>
            i === idx ? { ...x, content: text, edit_count: d.edit_count } : x
          )
        );
        setEditing(null);
      }
    } catch (e: any) {
      Alert.alert('Edit failed', e.message || 'Try again');
    } finally {
      setMemBusy(false);
    }
  };

  // ── Clear the whole session ──
  const clearSession = () => {
    Alert.alert(
      'Clear conversation',
      'All messages in this conversation will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (token) {
              try {
                await fetch(`${API_BASE}/history/session/${sessionId}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                });
              } catch {}
            }
            setMessages([]);
            setSessionId(newSessionId());
          },
        },
      ]
    );
  };

  // ── Send ──
  const send = async () => {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setInput('');
    setEditing(null);

    const userMsg: ChatMsg = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      // Save the user message
      const userId = await saveMessage('user', q);
      if (userId) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy.length - 1;
          copy[last] = { ...copy[last], id: userId };
          return copy;
        });
      }

      // Build conversation (up to 40 turns for memory)
      const history = messages.slice(-MAX_HISTORY_SENT);
      const payload = {
        messages: [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: q },
        ],
        max_tokens: 8000,
        memory,
        use_memory: true,
      };

      const r = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }

      const data = await r.json();
      const assistantMsg: ChatMsg = { role: 'assistant', content: data.reply };
      setMessages((prev) => [...prev, assistantMsg]);

      const assistantId = await saveMessage('assistant', data.reply);
      if (assistantId) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy.length - 1;
          copy[last] = { ...copy[last], id: assistantId };
          return copy;
        });
      }
    } catch (e: any) {
      Alert.alert('GAIA error', e.message || 'Please try again');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ I could not reach the server. Please try again.' },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.dot} />
          <Text style={styles.headerTitle}>GAIA Agronomist</Text>
        </View>
        <Pressable onPress={() => setShowMemory(true)} style={styles.iconBtn} hitSlop={10}>
          <Text style={styles.iconText}>★</Text>
        </Pressable>
        <Pressable onPress={() => setShowHistory(true)} style={styles.iconBtn} hitSlop={10}>
          <Text style={styles.iconText}>≡</Text>
        </Pressable>
        <Pressable onPress={clearSession} style={styles.iconBtn} hitSlop={10}>
          <Text style={[styles.iconText, { color: palette.danger }]}>␡</Text>
        </Pressable>
      </View>

      {/* Messages */}
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Hello, I am GAIA.</Text>
            <Text style={styles.emptyText}>
              Ask me anything — farming, science, math, business, health, writing.
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
                <Text style={[styles.bubbleText, m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAi]}>
                  {m.content}
                </Text>
                {m.role === 'user' && m.edit_count != null && m.edit_count > 0 ? (
                  <Text style={styles.editBadge}>
                    edited · {m.edit_count}/{MAX_EDITS}
                  </Text>
                ) : null}
              </View>
              <View style={styles.actions}>
                {m.role === 'user' && (m.edit_count || 0) < MAX_EDITS ? (
                  <Pressable onPress={() => beginEdit(i)} style={styles.actionBtn}>
                    <Text style={styles.actionText}>✎</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => deleteMessage(m, i)} style={styles.actionBtn}>
                  <Text style={[styles.actionText, { color: palette.danger }]}>🗑</Text>
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

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          value={editing ? editing.text : input}
          onChangeText={(t) => (editing ? setEditing({ ...editing, text: t }) : setInput(t))}
          placeholder={editing ? 'Editing…' : 'Ask GAIA anything…'}
          placeholderTextColor={palette.textDim}
          style={styles.input}
          multiline
        />
        {editing ? (
          <>
            <Pressable onPress={() => setEditing(null)} style={[styles.sendBtn, { backgroundColor: palette.surface }]}>
              <Text style={[styles.sendBtnText, { color: palette.text }]}>✕</Text>
            </Pressable>
            <Pressable onPress={commitEdit} disabled={memBusy} style={styles.sendBtn}>
              {memBusy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.sendBtnText}>✓</Text>}
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={send}
            disabled={busy || !input.trim()}
            style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        )}
      </View>

      {/* History Modal */}
      <Modal visible={showHistory} animationType="slide" transparent onRequestClose={() => setShowHistory(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Conversation</Text>
            <Text style={styles.modalSub}>{messages.length} messages</Text>
            <Pressable
              onPress={() => {
                setSessionId(newSessionId());
                setMessages([]);
                setShowHistory(false);
              }}
              style={styles.modalBtn}
            >
              <Text style={styles.modalBtnText}>+ Start new conversation</Text>
            </Pressable>
            <Pressable onPress={() => setShowHistory(false)} style={[styles.modalBtn, styles.modalBtnGhost]}>
              <Text style={styles.modalBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Memory Modal */}
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
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, color: palette.text, fontWeight: '600' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.neon },
  headerTitle: { ...typography.body, color: palette.text, fontWeight: '800' },
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
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: palette.obsidian, fontWeight: '600' },
  bubbleTextAi: { color: palette.text },
  editBadge: { fontSize: 10, color: 'rgba(0,0,0,0.55)', marginTop: 4, fontStyle: 'italic' },
  actions: { flexDirection: 'row', marginLeft: 6, gap: 4 },
  actionBtn: { padding: 6 },
  actionText: { fontSize: 16, color: palette.textMuted },
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
