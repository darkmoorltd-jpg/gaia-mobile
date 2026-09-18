import { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useTheme, radius } from '../src/theme';

interface Msg { role: 'user' | 'ai'; text: string }

export default function Voice() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'ai', text: 'Hello. I am GAIA. Ask me anything about your farm - crops, pests, soil, or livestock.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async () => {
    if (!input.trim()) return;
    const q = input.trim();
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);

    setTimeout(() => {
      setMessages((m) => [...m, { role: 'ai', text: 'I am connecting to the GAIA backend. Once the API key is live, I will reply with detailed farming advice for: "' + q + '"' }]);
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 900);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.dot} />
        <Text style={styles.headerTitle}>GAIA Voice Agronomist</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {messages.map((m, i) => (
          <View key={i} style={[styles.row, m.role === 'user' ? styles.rowUser : styles.rowAi]}>
            <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
              <Text style={[styles.bubbleText, m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAi]}>{m.text}</Text>
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

      <View style={styles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask GAIA anything..."
          placeholderTextColor={palette.textDim}
          style={styles.input}
          multiline
        />
        <Pressable onPress={send} disabled={busy || !input.trim()} style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]}>
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: p.border },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: p.neon },
  headerTitle: { fontSize: 16, fontWeight: '800', color: p.text, letterSpacing: -0.3 },
  scroll: { padding: 16, paddingBottom: 20 },
  row: { marginBottom: 12 },
  rowUser: { alignItems: 'flex-end' },
  rowAi: { alignItems: 'flex-start' },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: { backgroundColor: p.neon, borderBottomRightRadius: 6 },
  bubbleAi: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: p.obsidian, fontWeight: '600' },
  bubbleTextAi: { color: p.text },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: p.border, backgroundColor: p.obsidian },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  sendBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, backgroundColor: p.neon },
  sendBtnText: { fontSize: 13, fontWeight: '800', color: p.obsidian },
});
