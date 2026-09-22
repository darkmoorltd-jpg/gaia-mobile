import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
  useWindowDimensions, Image,
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
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const MAX_EDITS = 5;
const MAX_IMAGES = 4;

const EASE_OUT = Easing.out(Easing.quad);
const EASE_IN = Easing.in(Easing.quad);

interface Msg {
  role: 'user' | 'ai';
  text: string;
  time: string;
  db_id?: number;
  edit_count?: number;
  edited_at?: string;
  attachments?: { kind: 'doc' | 'image'; name: string; uri?: string; id?: number }[];
}

interface Conv {
  id: string;
  title: string;
  updated_at: string;
}

interface AttachedDoc {
  id: number;
  name: string;
  chunks: number;
}

interface AttachedImage {
  uri: string;
  mime: string;
  base64: string;
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
        'Attach documents (PDF/DOCX) or images and I can read them.',
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

  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);
  const [attachedImgs, setAttachedImgs] = useState<AttachedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachSheet, setAttachSheet] = useState(false);
  const [isPicking, setIsPicking] = useState(false);

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

  const saveMessage = async (
    convId: string,
    role: 'user' | 'ai',
    text: string,
    attachments?: Msg['attachments'],
  ): Promise<number | null> => {
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
          attachments: attachments ? JSON.stringify(attachments) : null,
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
        .select('id, role, content, created_at, edit_count, edited_at, attachments')
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
            attachments: m.attachments ? JSON.parse(m.attachments) : undefined,
          })),
        );
        setCurrentConvId(conv.id);
        scrollBottom();
      }
    } catch {}
  };

  const startNewConversation = () => {
    setCurrentConvId(null);
    setAttachedDocs([]);
    setAttachedImgs([]);
    setMessages([
      {
        role: 'ai',
        text: 'New conversation. Ask me anything about your farm.',
        time: now(),
      },
    ]);
    setSidebarOpen(false);
  };

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

  const pickDocument = async () => {
    if (isPicking) return;
    setAttachSheet(false);
    await new Promise((r) => setTimeout(r, 400));
    setIsPicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'text/markdown',
          'text/csv',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const file = res.assets[0];
      await uploadDocument(
        file.uri,
        file.name || 'document',
        file.mimeType || 'application/octet-stream',
      );
    } catch (e: any) {
      Alert.alert('Pick failed', e?.message || 'unknown');
    } finally {
      setIsPicking(false);
    }
  };

  const uploadDocument = async (uri: string, name: string, mime: string) => {
    if (!user) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      if (!token) throw new Error('Session expired');

      const form = new FormData();
      // @ts-ignore
      form.append('file', { uri, name, type: mime });

      const res = await fetch(API_BASE + '/documents/upload', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error('Upload ' + res.status + ': ' + errText.slice(0, 120));
      }
      const data = await res.json();
      setAttachedDocs((prev) => [
        ...prev,
        { id: data.id, name: data.filename, chunks: data.chunk_count },
      ]);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'unknown');
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    if (isPicking) return;
    if (attachedImgs.length >= MAX_IMAGES) {
      Alert.alert('Limit', 'Max ' + MAX_IMAGES + ' images per message.');
      return;
    }
    setAttachSheet(false);
    await new Promise((r) => setTimeout(r, 400));
    setIsPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow access to your photos.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsEditing: false,
        base64: true,
        exif: false,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      const base64 = asset.base64 || '';
      if (!base64) {
        Alert.alert('Could not read image', 'Please try a different image.');
        return;
      }
      const mime = asset.mimeType || 'image/jpeg';
      setAttachedImgs((prev) => [...prev, { uri: asset.uri, mime, base64 }]);
    } catch (e: any) {
      Alert.alert('Pick failed', e?.message || 'unknown');
    } finally {
      setIsPicking(false);
    }
  };

  const removeAttachedDoc = (id: number) =>
    setAttachedDocs((prev) => prev.filter((d) => d.id !== id));
  const removeAttachedImg = (idx: number) =>
    setAttachedImgs((prev) => prev.filter((_, i) => i !== idx));

  const requestAIReply = async (
    history: { role: string; content: string }[],
    document_ids?: number[],
    images?: { data: string; mime: string }[],
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';
    if (!token) throw new Error('Session expired');

    const payload: any = { messages: history, max_tokens: 1500 };
    if (document_ids && document_ids.length) payload.document_ids = document_ids;
    if (images && images.length) payload.images = images;

    const res = await fetch(API_BASE + '/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(payload),
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
    if ((!q && attachedDocs.length === 0 && attachedImgs.length === 0) || busy) return;

    const docIds = attachedDocs.map((d) => d.id);
    const imgPayload = attachedImgs.map((i) => ({ data: i.base64, mime: i.mime }));
    const attachmentChips: Msg['attachments'] = [
      ...attachedDocs.map((d) => ({ kind: 'doc' as const, name: d.name, id: d.id })),
      ...attachedImgs.map((i) => ({ kind: 'image' as const, name: 'image', uri: i.uri })),
    ];

    const userMsg: Msg = {
      role: 'user',
      text: q || '(sent attachments)',
      time: now(),
      edit_count: 0,
      attachments: attachmentChips.length ? attachmentChips : undefined,
    };
    const history = [...messages, userMsg].map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }));

    setMessages((m) => [...m, userMsg]);
    setInput('');
    setAttachedDocs([]);
    setAttachedImgs([]);
    setBusy(true);
    scrollBottom();

    const convId = await ensureConversation(q || 'attachment');
    if (convId) {
      await saveMessage(convId, 'user', userMsg.text, attachmentChips);
      await touchConversation(convId);
    }

    try {
      const reply = await requestAIReply(history, docIds, imgPayload);
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

  const openEdit = (idx: number) => {
    const m = messages[idx];
    if (!m || m.role !== 'user') return;
    if ((m.edit_count ?? 0) >= MAX_EDITS) {
      Alert.alert('Edit limit', 'You can only edit ' + MAX_EDITS + ' times.');
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
      Alert.alert('Edit limit reached', 'Max ' + MAX_EDITS + ' edits.');
      cancelEdit();
      return;
    }
    const newText = editText.trim();
    if (!newText || newText === msg.text) {
      cancelEdit();
      return;
    }

    setEditBusy(true);
    try {
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

      const trimmed = messages.slice(0, editIdx + 1).map((m, i) =>
        i === editIdx
          ? { ...m, text: newText, edit_count: nextCount, edited_at: new Date().toISOString(), time: now() }
          : m,
      );

      if (currentConvId && msg.db_id) {
        await supabase
          .from('agronomist_messages')
          .delete()
          .eq('conversation_id', currentConvId)
          .gt('id', msg.db_id);
      }

      setMessages(trimmed);
      setEditOpen(false);
      setEditIdx(null);
      setEditText('');
      setBusy(true);
      scrollBottom();

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

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Message copied.');
  };

  const speak = async (text: string, idx: number) => {
    if (speakingIdx === idx) {
      Speech.stop();
      setSpeakingIdx(null);
      return;
    }
    Speech.stop();
    setSpeakingIdx(idx);
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

  const remainingEdits = (m: Msg) => MAX_EDITS - (m.edit_count ?? 0);

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
              {busy ? 'Thinking...' : recording ? 'Listening...' : 'Online'}
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

            <View style={{ maxWidth: '82%' }}>
              {m.attachments && m.attachments.length > 0 ? (
                <View style={styles.attachmentChips}>
                  {m.attachments.map((a, ai) => (
                    <View key={ai} style={styles.attachmentChip}>
                      <Text style={styles.attachmentChipIcon}>
                        {a.kind === 'doc' ? 'DOC' : 'IMG'}
                      </Text>
                      <Text style={styles.attachmentChipText} numberOfLines={1}>
                        {a.name}
                      </Text>
                    </View>
                  ))}
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
                        style={[styles.actionBtn, remainingEdits(m) <= 0 && { opacity: 0.35 }]}
                      >
                        <Text style={styles.actionIcon}>E</Text>
                      </Pressable>
                    )}
                  </View>
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

      {attachedDocs.length || attachedImgs.length || uploading ? (
        <View style={styles.attachmentsBar}>
          {uploading ? (
            <View style={styles.attachingChip}>
              <ActivityIndicator color={palette.neon} size="small" />
              <Text style={styles.attachingText}>Uploading...</Text>
            </View>
          ) : null}
          {attachedDocs.map((d) => (
            <Pressable
              key={'d' + d.id}
              onPress={() => removeAttachedDoc(d.id)}
              style={styles.attachedChip}
            >
              <Text style={styles.attachedChipIcon}>DOC</Text>
              <Text style={styles.attachedChipName} numberOfLines={1}>{d.name}</Text>
              <Text style={styles.attachedChipX}>X</Text>
            </Pressable>
          ))}
          {attachedImgs.map((img, idx) => (
            <Pressable
              key={'i' + idx}
              onPress={() => removeAttachedImg(idx)}
              style={styles.attachedImg}
            >
              <Image source={{ uri: img.uri }} style={styles.attachedImgThumb} />
              <View style={styles.attachedImgX}>
                <Text style={styles.attachedImgXText}>X</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.inputBar}>
        <Pressable
          onPress={() => setAttachSheet(true)}
          disabled={busy || uploading || isPicking}
          style={[styles.attachBtn, (busy || uploading || isPicking) && { opacity: 0.5 }]}
        >
          <Text style={styles.attachIcon}>+</Text>
        </Pressable>

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
          disabled={busy || (!input.trim() && !attachedDocs.length && !attachedImgs.length)}
          style={[
            styles.sendBtn,
            (busy || (!input.trim() && !attachedDocs.length && !attachedImgs.length)) && { opacity: 0.4 },
          ]}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>

      {recording ? (
        <View style={styles.recordingBar}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>Recording - tap X to stop</Text>
        </View>
      ) : null}

      <Modal visible={attachSheet} transparent animationType="slide" onRequestClose={() => setAttachSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setAttachSheet(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetKicker}>ATTACH</Text>
            <Pressable onPress={pickDocument} disabled={isPicking} style={styles.sheetOption}>
              <Text style={styles.sheetIcon}>DOC</Text>
              <View>
                <Text style={styles.sheetTitle}>Document</Text>
                <Text style={styles.sheetSub}>PDF, DOCX, TXT - GAIA reads it</Text>
              </View>
            </Pressable>
            <Pressable onPress={pickImage} disabled={isPicking} style={styles.sheetOption}>
              <Text style={styles.sheetIcon}>IMG</Text>
              <View>
                <Text style={styles.sheetTitle}>Image</Text>
                <Text style={styles.sheetSub}>Up to {MAX_IMAGES} - GAIA sees it</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
              <Text style={styles.drawerEmpty}>No past conversations.</Text>
            ) : (
              conversations.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => loadConversation(c)}
                  style={[styles.drawerItem, currentConvId === c.id && styles.drawerItemActive]}
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

      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={cancelEdit}>
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
              multiline
              style={styles.editInput}
              maxLength={1000}
              autoFocus
            />
            <View style={styles.editActions}>
              <Pressable onPress={cancelEdit} disabled={editBusy} style={[styles.editCancel, editBusy && { opacity: 0.5 }]}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveEdit}
                disabled={editBusy || !editText.trim()}
                style={[styles.editSave, (editBusy || !editText.trim()) && { opacity: 0.5 }]}
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
    headerTitle: { fontSize: 16, fontWeight: '900', color: p.text },
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
    bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
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
    editBadgeUser: { color: p.obsidian, backgroundColor: 'rgba(0,0,0,0.15)' },
    editBadgeAi: { color: p.neon, backgroundColor: p.neonSoft },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    actionIcon: { fontSize: 12, color: p.neon, fontWeight: '700' },
    thinkingBubble: { paddingVertical: 14 },
    tomatoRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'flex-end', height: 30 },
    tomato: { fontSize: 22 },
    thinkingText: { fontSize: 11, color: p.textMuted, textAlign: 'center', marginTop: 6 },
    attachmentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    attachmentChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.15)',
    },
    attachmentChipIcon: { fontSize: 9, fontWeight: '900', color: p.obsidian, letterSpacing: 0.5 },
    attachmentChipText: { fontSize: 11, color: p.obsidian, maxWidth: 180 },
    attachmentsBar: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8,
      borderTopWidth: 1, borderTopColor: p.border,
      backgroundColor: p.surface,
    },
    attachedChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
      backgroundColor: p.obsidian, borderWidth: 1, borderColor: p.borderHi,
    },
    attachedChipIcon: { fontSize: 9, fontWeight: '900', color: p.neon },
    attachedChipName: { fontSize: 11, color: p.text, maxWidth: 140 },
    attachedChipX: { fontSize: 11, color: p.danger, fontWeight: '900', marginLeft: 4 },
    attachedImg: { position: 'relative' },
    attachedImgThumb: { width: 54, height: 54, borderRadius: 10, borderWidth: 1, borderColor: p.borderHi },
    attachedImgX: {
      position: 'absolute', top: -4, right: -4,
      width: 18, height: 18, borderRadius: 9,
      backgroundColor: p.danger, alignItems: 'center', justifyContent: 'center',
    },
    attachedImgXText: { fontSize: 10, color: '#fff', fontWeight: '900' },
    attachingChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
      backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
    },
    attachingText: { fontSize: 11, color: p.neon, fontWeight: '700' },
    inputBar: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 8,
      paddingHorizontal: 12, paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: p.border, backgroundColor: p.obsidian,
    },
    attachBtn: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.borderHi,
      alignItems: 'center', justifyContent: 'center',
    },
    attachIcon: { fontSize: 22, color: p.neon, fontWeight: '900' },
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
    drawerTitle: { fontSize: 24, fontWeight: '900', color: p.text, marginTop: 4 },
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
    sheetBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: p.abyss,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 20,
      borderTopWidth: 1, borderColor: p.borderHi,
    },
    sheetKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon, marginBottom: 14 },
    sheetOption: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      padding: 16, borderRadius: 14,
      backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
      marginBottom: 10,
    },
    sheetIcon: {
      fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1,
      width: 40, height: 40, borderRadius: 20, textAlign: 'center',
      lineHeight: 40, backgroundColor: p.neonSoft, overflow: 'hidden',
    },
    sheetTitle: { fontSize: 15, fontWeight: '800', color: p.text },
    sheetSub: { fontSize: 11, color: p.textMuted, marginTop: 2 },
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
    editKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
    editCounter: { fontSize: 11, fontWeight: '700', color: p.textMuted },
    editInput: {
      minHeight: 100, maxHeight: 260,
      paddingHorizontal: 14, paddingVertical: 12,
      borderRadius: 14, backgroundColor: p.surface,
      borderWidth: 1, borderColor: p.border,
      color: p.text, fontSize: 15,
      textAlignVertical: 'top',
    },
    editActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
    editCancel: {
      flex: 1, paddingVertical: 14, borderRadius: 14,
      borderWidth: 1.5, borderColor: p.border, alignItems: 'center',
    },
    editCancelText: { color: p.text, fontWeight: '800', fontSize: 14 },
    editSave: {
      flex: 2, paddingVertical: 14, borderRadius: 14,
      backgroundColor: p.neon, alignItems: 'center',
    },
    editSaveText: { color: p.obsidian, fontWeight: '900', fontSize: 14 },
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
