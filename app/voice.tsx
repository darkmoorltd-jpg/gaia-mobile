import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, withDelay, Easing,
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
import { speakText, stopSpeaking } from '../src/utils/tts';
import { transcribeAudio } from '../src/utils/stt';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const MAX_EDITS = 5;

const EASE_OUT = Easing.out(Easing.quad);
const EASE_IN = Easing.in(Easing.quad);

interface Msg {
  role: 'user' | 'ai';
  text: string;
  time: string;
  db_id?: number;
  edit_count?: number;
  edited_at?: string;
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
  const markdownRules = createMarkdownRules(palette);

  const drawerWidth = Math.min(320, screenW * 0.85);

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'ai',
      text:
        'Hello. I am **GAIA**, your personal agronomist.\n\n' +
        'Ask me anything about your farm - crops, pests, soil, or livestock.\n\n' +
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
  const [voiceLang, setVoiceLang] = useState('en');

  useEffect(() => {
    AsyncStorage.getItem('gaia.language').then((v) => { if (v) setVoiceLang(v); });
  },);

  // ---- EDIT STATE ----
  const [editOpen, setEditOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const scrollRef = useRef<ScrollView | null>(null);
  const drawerX = useSharedValue(-drawerWidth);

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

  useEffect(() => {
    drawerX.value = withTiming(sidebarOpen ? 0 : -drawerWidth, { duration: 240 });
  }, [sidebarOpen, drawerWidth]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: sidebarOpen ? 1 : 0,
  }));

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const scrollBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

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

  // ---------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------
  const saveMessage = async (convId: string, role: 'user' | 'ai', text: string): Promise<number | null> => {
    if (!user) return null;
    try {
      const { data } = await supabase
        .from('agronomist_messages')
        .insert({
          conversation_id: convId,
          user_id: user.id,
          role,
          content: text,
          edit_count: 0,
        })
        .select('id')
        .single();
      return data?.id ?? null;
    } catch {
      return null;
    }
  };

  const ensureConversation = async (firstUserMsg: string): Promise<string | null> => {
    if (!user) return null;
    if (currentConvId) return currentConvId;
    try {
      const title = firstUserMsg.slice(0, 40) + (firstUserMsg.length > 40 ? '...' : '');
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

  const loadConversation = async (conv: Conv) => {
    setSidebarOpen(false);
    try {
      const { data } = await supabase
        .from('agronomist_messages')
        .select('id, role, content, created_at, edit_count, edited_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
      if (data) {
        setMessages(
          data.map((m: any) => ({
            role: m.role,
            text: m.content,
            time: timeOf(m.created_at),
            db_id: m.id,
            edit_count: m.edit_count ?? 0,
            edited_at: m.edited_at,
          })),
        );
        setCurrentConvId(conv.id);
        scrollBottom();
      }
    } catch {}
  };

  const startNewConversation = () => {
    setCurrentConvId(null);
    setMessages([
      {
        role: 'ai',
        text: 'New conversation. Ask me anything about your farm - crops, pests, soil, or livestock.',
        time: now(),
      },
    ]);
    setSidebarOpen(false);
  };

  // ---------------------------------------------------------
  // Recording
  // ---------------------------------------------------------
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

      const result = await transcribeAudio(uri, voiceLang, token);
      if (result.error) throw new Error(result.error);
      const text = result.text;
      if (text) setInput(text);
      else Alert.alert('No speech detected', 'Please try again.');
    } catch (e: any) {
      Alert.alert('Transcription failed', e?.message || 'unknown');
    } finally {
      setTranscribing(false);
    }
  };

  // ---------------------------------------------------------
  // AI round-trip
  // ---------------------------------------------------------
  const requestAIReply = async (history: { role: string; content: string }[]) => {
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
    return data.reply || 'No reply from GAIA.';
  };

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;

    const userMsg: Msg = { role: 'user', text: q, time: now(), edit_count: 0 };
    const history = [...messages, userMsg].map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }));

    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);
    scrollBottom();

    const convId = await ensureConversation(q);
    let userDbId: number | null = null;
    if (convId) {
      userDbId = await saveMessage(convId, 'user', q);
      await touchConversation(convId);
    }

    try {
      const reply = await requestAIReply(history);
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

  // ---------------------------------------------------------
  // EDIT — open, save, re-run AI
  // ---------------------------------------------------------
  const openEdit = (idx: number) => {
    const m = messages[idx];
    if (!m || m.role !== 'user') return;
    if ((m.edit_count ?? 0) >= MAX_EDITS) {
      Alert.alert('Edit limit reached', `You can only edit a message ${MAX_EDITS} times.`);
      return;
    }
    setEditIdx(idx);
    setEditText(m.text);
    setEditOpen(true);
  };

  const cancelEdit = () => {
    setEditOpen(false);
    setEditIdx(null);
    setEditText('');
  };

  const saveEdit = async () => {
    if (editIdx === null || !user) return;
    const msg = messages[editIdx];
    if (!msg || msg.role !== 'user') return;

    const currentCount = msg.edit_count ?? 0;
    if (currentCount >= MAX_EDITS) {
      Alert.alert('Edit limit reached', `You can only edit a message ${MAX_EDITS} times.`);
      cancelEdit();
      return;
    }

    const newText = editText.trim();
    if (!newText) {
      Alert.alert('Empty message', 'Message cannot be empty.');
      return;
    }
    if (newText === msg.text) {
      cancelEdit();
      return;
    }

    setEditBusy(true);
    try {
      // 1) Update the DB row
      const nextCount = currentCount + 1;
      if (msg.db_id) {
        await supabase
          .from('agronomist_messages')
          .update({
            content: newText,
            edit_count: nextCount,
            edited_at: new Date().toISOString(),
          })
          .eq('id', msg.db_id)
          .eq('user_id', user.id);
      }

      // 2) Trim the message list: keep up to and including the edited one, drop the rest
      const trimmed = messages.slice(0, editIdx + 1).map((m, i) =>
        i === editIdx
          ? { ...m, text: newText, edit_count: nextCount, edited_at: new Date().toISOString(), time: now() }
          : m
      );

      // 3) Delete all messages after this one in the DB
      if (currentConvId && msg.db_id) {
        await supabase
          .from('agronomist_messages')
          .delete()
          .eq('conversation_id', currentConvId)
          .gt('id', msg.db_id);
      }

      // 4) Replace state
      setMessages(trimmed);
      setEditOpen(false);
      setEditIdx(null);
      setEditText('');
      setBusy(true);
      scrollBottom();

      // 5) Re-run AI with the edited history
      const history = trimmed.map((m) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));

      const reply = await requestAIReply(history);
      setMessages((m) => [...m, { role: 'ai', text: reply, time: now() }]);

      if (currentConvId) {
        await saveMessage(currentConvId, 'ai', reply);
        await touchConversation(currentConvId);
      }
    } catch (e: any) {
      Alert.alert('Edit failed', e?.message || 'unknown');
    } finally {
      setEditBusy(false);
      setBusy(false);
      scrollBottom();
    }
  };

  // ---------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------
  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Message copied to clipboard.');
  };

  const speak = async (text: string, idx: number) => {
    if (speakingIdx === idx) {
      stopSpeaking();
      setSpeakingIdx(null);
      return;
    }
    setSpeakingIdx(idx);
    speakText(text, {
      language: voiceLang,
      rate: 0.95,
      pitch: 1.0,
      onDone: () => setSpeakingIdx(null),
      onError: () => setSpeakingIdx(null),
    });
  };

  const remainingEdits = (m: Msg) => MAX_EDITS - (m.edit_count ?? 0);

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}
    >
      <View style={styles.header}>
        <Pressable onPress={() => setSidebarOpen(true)} style={styles.hamburger}>
          <Text style={styles.hamburgerIcon}>H</Text>
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>GA</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>GAIA Agronomist</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSub}>
              {busy ? 'Thinking...' : recording ? 'Listening...' : 'Online - ready to help'}
            </Text>
          </View>
        </View>
        <Pressable onPress={startNewConversation} style={styles.newChatBtn}>
          <Text style={styles.newChatIcon}>N</Text>
        </Pressable>
      </View>

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
                <Text style={styles.smallAvatarEmoji}>GA</Text>
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
                <Markdown style={markdownRules}>{m.text}</Markdown>
              )}

              <View style={styles.bubbleFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={[
                      styles.bubbleTime,
                      m.role === 'user' ? styles.bubbleTimeUser : styles.bubbleTimeAi,
                    ]}
                  >
                    {m.time}
                  </Text>
                  {m.role === 'user' && (m.edit_count ?? 0) > 0 ? (
                    <Text
                      style={[
                        styles.editBadge,
                        m.role === 'user' ? styles.editBadgeUser : styles.editBadgeAi,
                      ]}
                    >
                      edited {m.edit_count}/{MAX_EDITS}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => copyToClipboard(m.text)} style={styles.actionBtn}>
                    <Text style={styles.actionIcon}>C</Text>
                  </Pressable>
                  {m.role === 'ai' ? (
                    <Pressable onPress={() => speak(m.text, i)} style={styles.actionBtn}>
                      <Text style={styles.actionIcon}>
                        {speakingIdx === i ? 'P' : 'S'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => openEdit(i)}
                      disabled={remainingEdits(m) <= 0}
                      style={[
                        styles.actionBtn,
                        remainingEdits(m) <= 0 && { opacity: 0.35 },
                      ]}
                    >
                      <Text style={styles.actionIcon}>E</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </View>
        ))}

        {busy ? (
          <View style={[styles.row, styles.rowAi]}>
            <View style={styles.smallAvatar}>
              <Text style={styles.smallAvatarEmoji}>GA</Text>
            </View>
            <View style={[styles.bubble, styles.bubbleAi, styles.thinkingBubble]}>
              <View style={styles.tomatoRow}>
                <Animated.Text style={[styles.tomato, t1Style]}>{'\uD83C\uDF45'}</Animated.Text>
                <Animated.Text style={[styles.tomato, t2Style]}>{'\uD83C\uDF45'}</Animated.Text>
                <Animated.Text style={[styles.tomato, t3Style]}>{'\uD83C\uDF45'}</Animated.Text>
              </View>
              <Text style={styles.thinkingText}>GAIA is thinking...</Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 20 }} />
      </ScrollView>

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
            <Text style={styles.micIcon}>{recording ? 'X' : 'M'}</Text>
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
          <Text style={styles.recText}>Recording - tap X to stop and transcribe</Text>
        </View>
      ) : null}

      {/* ---------- HISTORY DRAWER ---------- */}
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
            <Text style={styles.drawerNewText}>+ New conversation</Text>
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

      {/* ---------- EDIT MESSAGE MODAL ---------- */}
      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={cancelEdit}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editBackdrop}
        >
          <View style={styles.editCard}>
            <View style={styles.editHeader}>
              <Text style={styles.editKicker}>EDIT MESSAGE</Text>
              {editIdx !== null ? (
                <Text style={styles.editCounter}>
                  {messages[editIdx]?.edit_count ?? 0}/{MAX_EDITS} edits used
                </Text>
              ) : null}
            </View>

            <TextInput
              value={editText}
              onChangeText={setEditText}
              placeholder="Edit your message..."
              placeholderTextColor={palette.textDim}
              multiline
              style={styles.editInput}
              maxLength={1000}
              autoFocus
            />

            <Text style={styles.editHint}>
              {editIdx !== null
                ? `You can edit this message ${remainingEdits(messages[editIdx])} more time${remainingEdits(messages[editIdx]) === 1 ? '' : 's'}. Saving will regenerate GAIA's reply.`
                : ''}
            </Text>

            <View style={styles.editActions}>
              <Pressable
                onPress={cancelEdit}
                disabled={editBusy}
                style={[styles.editCancel, editBusy && { opacity: 0.5 }]}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={saveEdit}
                disabled={editBusy || !editText.trim()}
                style={[
                  styles.editSave,
                  (editBusy || !editText.trim()) && { opacity: 0.5 },
                ]}
              >
                {editBusy ? (
                  <ActivityIndicator color={palette.obsidian} size="small" />
                ) : (
                  <Text style={styles.editSaveText}>Save & Regenerate</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
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
    const nowD = new Date();
    const diffH = (nowD.getTime() - d.getTime()) / 3600000;
    if (diffH < 1) return 'Just now';
    if (diffH < 24) return Math.floor(diffH) + 'h ago';
    if (diffH < 48) return 'Yesterday';
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}

const createStyles = (p: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: p.obsidian },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 12,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: p.border,
    },
    hamburger: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    hamburgerIcon: { fontSize: 18, color: p.text, fontWeight: '700' },
    avatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarEmoji: { fontSize: 13, color: p.neon, fontWeight: '900' },
    headerTitle: { fontSize: 16, fontWeight: '900', color: p.text, letterSpacing: -0.3 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: p.neon },
    headerSub: { fontSize: 11, color: p.textMuted },
    newChatBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
      alignItems: 'center', justifyContent: 'center',
    },
    newChatIcon: { fontSize: 16, color: p.neon, fontWeight: '900' },
    scroll: { padding: 16, paddingBottom: 20 },
    row: { marginBottom: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    rowUser: { justifyContent: 'flex-end' },
    rowAi: { justifyContent: 'flex-start' },
    smallAvatar: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
      alignItems: 'center', justifyContent: 'center',
    },
    smallAvatarEmoji: { fontSize: 10, color: p.neon, fontWeight: '900' },
    bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
    bubbleUser: { backgroundColor: p.neon, borderBottomRightRadius: 5 },
    bubbleAi: {
      backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
      borderBottomLeftRadius: 5,
    },
    bubbleTextUser: { fontSize: 15, lineHeight: 21, color: p.obsidian, fontWeight: '600' },
    bubbleFooter: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 8,
    },
    bubbleTime: { fontSize: 9, opacity: 0.6 },
    bubbleTimeUser: { color: p.obsidian },
    bubbleTimeAi: { color: p.textMuted },
    editBadge: {
      fontSize: 9, fontWeight: '700', letterSpacing: 0.5,
      paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
    },
    editBadgeUser: {
      color: p.obsidian, backgroundColor: 'rgba(0,0,0,0.15)',
    },
    editBadgeAi: {
      color: p.neon, backgroundColor: p.neonSoft,
    },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    actionIcon: { fontSize: 12, color: p.neon, fontWeight: '700' },
    thinkingBubble: { paddingVertical: 14 },
    tomatoRow: {
      flexDirection: 'row', gap: 8, justifyContent: 'center',
      alignItems: 'flex-end', height: 30,
    },
    tomato: { fontSize: 22 },
    thinkingText: { fontSize: 11, color: p.textMuted, textAlign: 'center', marginTop: 6 },
    inputBar: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 8,
      paddingHorizontal: 12, paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: p.border, backgroundColor: p.obsidian,
    },
    micBtn: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.borderHi,
      alignItems: 'center', justifyContent: 'center',
    },
    micBtnActive: { backgroundColor: p.danger, borderColor: p.danger },
    micIcon: { fontSize: 16, color: p.neon, fontWeight: '900' },
    input: {
      flex: 1, minHeight: 46, maxHeight: 120,
      paddingHorizontal: 16, paddingVertical: 12, borderRadius: 23,
      backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
      color: p.text, fontSize: 14,
    },
    sendBtn: {
      paddingHorizontal: 16, paddingVertical: 13, borderRadius: 23,
      backgroundColor: p.neon, justifyContent: 'center',
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
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    drawer: {
      position: 'absolute', top: 0, bottom: 0, left: 0,
      backgroundColor: p.abyss, borderRightWidth: 1, borderRightColor: p.border,
    },
    drawerHeader: {
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 70 : 50,
      paddingBottom: 16,
    },
    drawerKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.neon },
    drawerTitle: {
      fontSize: 24, fontWeight: '900', color: p.text,
      letterSpacing: -0.8, marginTop: 4,
    },
    drawerNewBtn: {
      marginHorizontal: 16, paddingVertical: 14, paddingHorizontal: 16,
      borderRadius: 14, backgroundColor: p.neonSoft,
      borderWidth: 1, borderColor: p.borderHi,
    },
    drawerNewText: { color: p.neon, fontWeight: '800', fontSize: 14 },
    drawerScroll: { padding: 16 },
    drawerItem: {
      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
      backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
      marginBottom: 8,
    },
    drawerItemActive: { borderColor: p.borderHi, backgroundColor: p.neonSoft },
    drawerItemTitle: { color: p.text, fontSize: 13, fontWeight: '700' },
    drawerItemDate: { color: p.textMuted, fontSize: 10, marginTop: 4 },
    drawerEmpty: { color: p.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 30 },
    // ---- EDIT MODAL ----
    editBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: 24,
    },
    editCard: {
      width: '100%', maxWidth: 480,
      backgroundColor: p.abyss, borderRadius: 20,
      borderWidth: 1, borderColor: p.borderHi,
      padding: 20,
    },
    editHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 14,
    },
    editKicker: {
      fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon,
    },
    editCounter: {
      fontSize: 11, fontWeight: '700', color: p.textMuted,
    },
    editInput: {
      minHeight: 100, maxHeight: 260,
      paddingHorizontal: 14, paddingVertical: 12,
      borderRadius: 14, backgroundColor: p.surface,
      borderWidth: 1, borderColor: p.border,
      color: p.text, fontSize: 15,
      textAlignVertical: 'top',
    },
    editHint: {
      fontSize: 11, color: p.textMuted,
      marginTop: 10, lineHeight: 16,
    },
    editActions: {
      flexDirection: 'row', gap: 10, marginTop: 16,
    },
    editCancel: {
      flex: 1, paddingVertical: 14, borderRadius: 14,
      borderWidth: 1.5, borderColor: p.border,
      alignItems: 'center',
    },
    editCancelText: { color: p.text, fontWeight: '800', fontSize: 14 },
    editSave: {
      flex: 2, paddingVertical: 14, borderRadius: 14,
      backgroundColor: p.neon, alignItems: 'center',
    },
    editSaveText: { color: p.obsidian, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  });

const createMarkdownRules = (p: any) =>
  StyleSheet.create({
    body: { color: p.text, fontSize: 15, lineHeight: 22 },
    heading1: { color: p.text, fontSize: 20, fontWeight: '900', marginTop: 8, marginBottom: 6 },
    heading2: { color: p.text, fontSize: 18, fontWeight: '800', marginTop: 8, marginBottom: 4 },
    heading3: { color: p.text, fontSize: 16, fontWeight: '700', marginTop: 6, marginBottom: 4 },
    strong: { fontWeight: '800', color: p.text },
    em: { fontStyle: 'italic' },
    paragraph: { marginTop: 4, marginBottom: 6, flexWrap: 'wrap' },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    bullet_list_icon: { color: p.neon, marginRight: 6 },
    ordered_list_icon: { color: p.neon, marginRight: 6 },
    code_inline: {
      backgroundColor: 'rgba(0,255,136,0.12)',
      color: p.neon, paddingHorizontal: 4, borderRadius: 4,
      fontFamily: 'monospace', fontSize: 13,
    },
    code_block: {
      backgroundColor: p.abyss, borderColor: p.border, borderWidth: 1,
      borderRadius: 8, padding: 10, fontFamily: 'monospace',
      fontSize: 12, color: p.text, marginVertical: 6,
    },
    fence: {
      backgroundColor: p.abyss, borderColor: p.border, borderWidth: 1,
      borderRadius: 8, padding: 10, fontFamily: 'monospace',
      fontSize: 12, color: p.text, marginVertical: 6,
    },
    blockquote: {
      borderLeftWidth: 3, borderLeftColor: p.neon,
      paddingLeft: 10, marginVertical: 6, opacity: 0.9,
    },
    link: { color: p.neon, textDecorationLine: 'underline' },
    hr: { backgroundColor: p.border, height: 1, marginVertical: 8 },
  });
