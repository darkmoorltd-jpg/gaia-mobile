import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Screen, GlassCard, Pill } from '../src/components';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import {
  uploadDocument, listDocuments, deleteDocument, askRag, Document,
} from '../src/utils/rag';

interface Msg { role: 'user' | 'ai'; text: string; }

export default function RagChat() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [docs, setDocs] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [showDocs, setShowDocs] = useState(true);
  const scrollRef = useRef<ScrollView | null>(null);

  const refreshDocs = async () => {
    const d = await listDocuments();
    setDocs(d);
  };

  useEffect(() => {
    refreshDocs();
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, thinking]);

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'text/plain',
        'text/markdown',
        'image/jpeg',
        'image/png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];

    setUploading(true);
    try {
      const { doc, error } = await uploadDocument(
        asset.uri,
        asset.name,
        asset.mimeType ?? 'application/octet-stream',
      );
      if (error || !doc) {
        Alert.alert('Upload failed', error || 'Unknown error');
      } else {
        Alert.alert('Uploaded', 'Document is now part of your knowledge base');
        await refreshDocs();
      }
    } finally {
      setUploading(false);
    }
  };

  const removeDoc = async (id: string) => {
    Alert.alert('Delete document?', 'This will remove it from your knowledge base.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await deleteDocument(id);
          if (ok) setDocs((d) => d.filter((x) => x.id !== id));
        },
      },
    ]);
  };

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setThinking(true);
    try {
      const answer = await askRag(q, 'en');
      setMessages((m) => [...m, { role: 'ai', text: answer }]);
    } catch (e: any) {
      Alert.alert('Query failed', e?.message ?? 'Try again');
    } finally {
      setThinking(false);
    }
  };

  return (
    <Screen glow="crops">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← BACK</Text>
          </Pressable>
          <Pill label="Knowledge" color={palette.crops} />
        </View>

        <Text style={styles.title}>Ask GAIA</Text>
        <Text style={styles.subtitle}>Upload documents. Ask anything.</Text>

        <Pressable
          onPress={pickFile}
          disabled={uploading}
          style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
        >
          {uploading ? (
            <ActivityIndicator color={palette.obsidian} />
          ) : (
            <Text style={styles.uploadBtnText}>＋ UPLOAD DOCUMENT</Text>
          )}
        </Pressable>

        {docs.length > 0 && (
          <Pressable onPress={() => setShowDocs((v) => !v)} style={styles.docsToggle}>
            <Text style={styles.docsToggleText}>
              {showDocs ? '▼' : '▶'} {docs.length} document{docs.length === 1 ? '' : 's'} in knowledge base
            </Text>
          </Pressable>
        )}

        {showDocs && docs.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 90, marginTop: 8 }}
          >
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20 }}>
              {docs.map((d) => (
                <Pressable
                  key={d.id}
                  onLongPress={() => removeDoc(d.id)}
                  style={styles.docChip}
                >
                  <Text style={styles.docIcon}>📄</Text>
                  <Text style={styles.docName} numberOfLines={1}>{d.name}</Text>
                  <Text style={styles.docMeta}>{d.chunk_count} chunks</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.chat}
          style={{ flex: 1, marginTop: spacing.lg }}
        >
          {messages.length === 0 && (
            <GlassCard>
              <Text style={styles.emptyTitle}>How it works</Text>
              <Text style={styles.emptyBody}>
                {'1. Upload PDFs, docs, or images of farm manuals\n2. Ask a question in plain language\n3. GAIA answers using only your documents'}
              </Text>
            </GlassCard>
          )}

          {messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                m.role === 'user' ? styles.bubbleUser : styles.bubbleAi,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  m.role === 'user' && styles.bubbleTextUser,
                ]}
              >
                {m.text}
              </Text>
            </View>
          ))}

          {thinking && (
            <View style={[styles.bubble, styles.bubbleAi]}>
              <ActivityIndicator color={palette.neon} />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your documents…"
            placeholderTextColor={palette.textDim}
            style={styles.input}
            multiline
            onSubmitEditing={send}
          />
          <Pressable onPress={send} disabled={!input.trim()} style={styles.sendBtn}>
            <Text style={styles.sendIcon}>→</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, paddingHorizontal: 20, marginTop: 8 },
  subtitle: { fontSize: 14, color: p.textMuted, paddingHorizontal: 20, marginTop: 4 },
  uploadBtn: {
    marginHorizontal: 20,
    marginTop: spacing.lg,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: p.neon,
    alignItems: 'center',
  },
  uploadBtnText: { color: p.obsidian, fontWeight: '900', fontSize: 13, letterSpacing: 1.2 },
  docsToggle: { paddingHorizontal: 20, paddingTop: 14 },
  docsToggleText: { fontSize: 12, color: p.textMuted, fontWeight: '700' },
  docChip: {
    width: 130,
    padding: 10,
    borderRadius: 12,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  },
  docIcon: { fontSize: 22 },
  docName: { fontSize: 12, color: p.text, fontWeight: '600', marginTop: 4 },
  docMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  chat: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  bubble: { maxWidth: '85%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18 },
  bubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.borderHi,
  },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: p.neon },
  bubbleText: { fontSize: 15, color: p.text, lineHeight: 21 },
  bubbleTextUser: { color: p.obsidian, fontWeight: '600' },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: p.text, marginBottom: 8 },
  emptyBody: { fontSize: 13, color: p.textMuted, lineHeight: 20 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: p.text,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: p.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: p.obsidian, fontSize: 22, fontWeight: '900' },
});
