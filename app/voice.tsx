import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Screen, GlassCard, Pill, NeonButton } from '../src/components';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import {
  startRecording, stopRecording, transcribeAudio, speak, stopSpeaking,
  askGaia, ChatTurn,
} from '../src/utils/voice';

const LANGUAGES = [
  { code: 'en-NG', label: 'English', flag: '🇬🇧', short: 'en' },
  { code: 'ha-NG', label: 'Hausa', flag: '🇳🇬', short: 'ha' },
  { code: 'yo-NG', label: 'Yoruba', flag: '🇳🇬', short: 'yo' },
  { code: 'ig-NG', label: 'Igbo', flag: '🇳🇬', short: 'ig' },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷', short: 'fr' },
  { code: 'sw-KE', label: 'Kiswahili', flag: '🇰🇪', short: 'sw' },
];

const GREETINGS: Record<string, string> = {
  'en-NG': "Hello, I'm GAIA. What can I do for you today?",
  'ha-NG': "Sannu, ni ce GAIA. Me zan iya yi maka yau?",
  'yo-NG': "Ẹ n lẹ, Èmi ni GAIA. Kí ni mo lè ṣe fún ọ lónìí?",
  'ig-NG': "Ndeewo, abụ m GAIA. Gịnị ka m nwere ike imere gị taa?",
  'fr-FR': "Bonjour, je suis GAIA. Que puis-je faire pour vous aujourd'hui ?",
  'sw-KE': "Habari, mimi ni GAIA. Nikufanyie nini leo?",
};

interface Msg { role: 'user' | 'ai'; text: string; }

export default function VoiceAgronomist() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [typedMode, setTypedMode] = useState(false);
  const [typedText, setTypedText] = useState('');

  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  // ---------- Greet on mount + on language change ----------
  useEffect(() => {
    const greet = GREETINGS[language.code] || GREETINGS['en-NG'];
    setMessages([{ role: 'ai', text: greet }]);
    setSpeaking(true);
    speak(greet, language.code, () => setSpeaking(false));
    return () => stopSpeaking();
  }, [language]);

  // ---------- Auto-scroll ----------
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, thinking]);

  // ---------- Handle user turn ----------
  const handleUserUtterance = async (text: string) => {
    if (!text.trim()) return;

    setMessages((m) => [...m, { role: 'user', text }]);
    setThinking(true);

    const history: ChatTurn[] = messages.slice(-6).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    try {
      const reply = await askGaia(text, language.code, history);
      setMessages((m) => [...m, { role: 'ai', text: reply }]);
      setThinking(false);
      setSpeaking(true);
      speak(reply, language.code, () => setSpeaking(false));
    } catch (e: any) {
      setThinking(false);
      Alert.alert('GAIA could not respond', e?.message ?? 'Try again');
    }
  };

  // ---------- Mic button ----------
  const onMicPress = async () => {
    // If GAIA is speaking → stop and let user interrupt
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }

    if (listening) {
      // Stop recording and process
      const uri = await stopRecording(recordingRef.current!);
      recordingRef.current = null;
      setListening(false);

      if (!uri) return;
      setThinking(true);
      try {
        const text = await transcribeAudio(uri, language.short);
        setThinking(false);
        if (text.trim()) await handleUserUtterance(text);
      } catch (e: any) {
        setThinking(false);
        Alert.alert('Transcription failed', e?.message ?? 'Try again');
      }
    } else {
      // Start recording
      try {
        const rec = await startRecording();
        recordingRef.current = rec;
        setListening(true);
      } catch (e: any) {
        Alert.alert('Microphone error', e?.message ?? 'Permission denied');
      }
    }
  };

  const onTypedSubmit = async () => {
    const text = typedText.trim();
    if (!text) return;
    setTypedText('');
    setTypedMode(false);
    await handleUserUtterance(text);
  };

  return (
    <Screen glow="livestock">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← BACK</Text>
          </Pressable>
          <Pill label="Voice AI" color={palette.livestock} />
        </View>

        <Text style={styles.title}>Talk to GAIA</Text>
        <Text style={styles.subtitle}>Ask anything. In your language.</Text>

        {/* Language chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.lg, maxHeight: 44 }}
        >
          <View style={styles.langRow}>
            {LANGUAGES.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => setLanguage(l)}
                style={[
                  styles.langChip,
                  language.code === l.code && styles.langChipActive,
                ]}
              >
                <Text style={styles.langFlag}>{l.flag}</Text>
                <Text
                  style={[
                    styles.langText,
                    language.code === l.code && styles.langTextActive,
                  ]}
                >
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Conversation */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.chat}
          style={{ flex: 1, marginTop: spacing.lg }}
        >
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

        {/* Typed input (fallback) */}
        {typedMode && (
          <View style={styles.typedRow}>
            <TextInput
              value={typedText}
              onChangeText={setTypedText}
              placeholder="Type your question…"
              placeholderTextColor={palette.textDim}
              style={styles.typedInput}
              autoFocus
              onSubmitEditing={onTypedSubmit}
            />
            <Pressable onPress={onTypedSubmit} style={styles.typedSend}>
              <Text style={styles.typedSendText}>→</Text>
            </Pressable>
          </View>
        )}

        {/* Mic + controls */}
        <View style={styles.controls}>
          <Pressable
            onPress={() => setTypedMode((v) => !v)}
            style={styles.sideBtn}
          >
            <Text style={styles.sideBtnText}>⌨</Text>
          </Pressable>

          <Pressable
            onPress={onMicPress}
            style={[
              styles.micBtn,
              listening && styles.micBtnListening,
              speaking && styles.micBtnSpeaking,
            ]}
          >
            <Text style={styles.micIcon}>
              {speaking ? '◼' : listening ? '●' : '🎙'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (speaking) { stopSpeaking(); setSpeaking(false); }
              const greet = GREETINGS[language.code] || GREETINGS['en-NG'];
              setMessages([{ role: 'ai', text: greet }]);
              setSpeaking(true);
              speak(greet, language.code, () => setSpeaking(false));
            }}
            style={styles.sideBtn}
          >
            <Text style={styles.sideBtnText}>↻</Text>
          </Pressable>
        </View>

        <Text style={styles.status}>
          {speaking ? 'GAIA is speaking…' :
           listening ? 'Listening… tap to stop' :
           thinking ? 'Thinking…' :
           'Tap the mic to speak'}
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56,
  },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, paddingHorizontal: 20, marginTop: 8 },
  subtitle: { fontSize: 14, color: p.textMuted, paddingHorizontal: 20, marginTop: 4 },
  langRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  langChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border,
  },
  langChipActive: { backgroundColor: p.neonSoft, borderColor: p.borderHi },
  langFlag: { fontSize: 14 },
  langText: { fontSize: 12, fontWeight: '700', color: p.textMuted },
  langTextActive: { color: p.neon },
  chat: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  bubble: {
    maxWidth: '85%', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 18,
  },
  bubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.borderHi,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: p.neon,
  },
  bubbleText: { fontSize: 15, color: p.text, lineHeight: 21 },
  bubbleTextUser: { color: p.obsidian, fontWeight: '600' },
  typedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, marginBottom: 12,
  },
  typedInput: {
    flex: 1, backgroundColor: p.surface, borderWidth: 1,
    borderColor: p.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: p.text, fontSize: 15,
  },
  typedSend: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: p.neon, alignItems: 'center', justifyContent: 'center',
  },
  typedSendText: { color: p.obsidian, fontSize: 22, fontWeight: '900' },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 20, paddingBottom: 8,
  },
  sideBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sideBtnText: { fontSize: 20, color: p.textMuted },
  micBtn: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: p.neon, alignItems: 'center', justifyContent: 'center',
    shadowColor: p.neon, shadowOpacity: 0.55, shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  micBtnListening: { backgroundColor: p.danger },
  micBtnSpeaking: { backgroundColor: p.warning },
  micIcon: { fontSize: 38, color: p.obsidian },
  status: {
    textAlign: 'center', fontSize: 12, color: p.textMuted,
    paddingVertical: 12, fontWeight: '600', letterSpacing: 0.5,
  },
});
