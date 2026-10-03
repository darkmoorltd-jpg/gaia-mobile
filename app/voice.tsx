import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, GlassCard, Pill } from '../src/components';
import { useTheme, spacing, radius } from '../src/theme';
import {
  recordUntilSilence, transcribeAudio, askGaia, speak, stopSpeaking,
  LANGUAGES, LangOption, isStopCommand, ChatTurn,
} from '../src/utils/voice';

type Mode = 'pick-language' | 'greeting' | 'listening' | 'thinking' | 'speaking' | 'paused';

interface Msg { role: 'user' | 'ai'; text: string; }

export default function VoiceScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [mode, setMode] = useState<Mode>('pick-language');
  const [language, setLanguage] = useState<LangOption | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [liveText, setLiveText] = useState('');
  const [level, setLevel] = useState(-60);
  const [typedMode, setTypedMode] = useState(false);
  const [typedText, setTypedText] = useState('');

  const scrollRef = useRef<ScrollView | null>(null);
  const sessionActive = useRef<boolean>(false);
  const modeRef = useRef<Mode>('pick-language');
  modeRef.current = mode;

  // ---------- Auto-scroll ----------
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, liveText, mode]);

  // ---------- Speak language prompt once user picks ----------
  useEffect(() => {
    if (mode !== 'greeting' || !language) return;

    let cancelled = false;
    (async () => {
      const promptText = language.prompt;
      setMessages([{ role: 'ai', text: promptText }]);
      setMode('speaking');
      await speak(promptText, language.ttsCode);
      if (cancelled) return;

      // Ask which language — listen for spoken answer
      setMode('listening');
      const uri = await recordUntilSilence({
        silenceThresholdDb: -35,
        silenceDurationMs: 1500,
        maxDurationMs: 12000,
        onLevel: setLevel,
      });
      if (cancelled || !uri) {
        setMode('paused');
        return;
      }
      setMode('thinking');
      try {
        const heard = await transcribeAudio(uri, language.code);
        if (!heard) {
          setMode('paused');
          return;
        }
        // Try to match a language from what was heard
        const matched = matchLanguage(heard);
        if (matched) {
          setLanguage(matched);
          await startSession(matched);
        } else {
          // Couldn't match — just start with the current language
          await startSession(language);
        }
      } catch (e: any) {
        Alert.alert('Voice error', e?.message ?? 'Try again');
        setMode('paused');
      }
    })();

    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, [mode === 'greeting']);

  // ---------- Match spoken language ----------
  const matchLanguage = (spoken: string): LangOption | null => {
    const s = spoken.toLowerCase();
    if (s.includes('english')) return LANGUAGES[0];
    if (s.includes('hausa')) return LANGUAGES[1];
    if (s.includes('yoruba')) return LANGUAGES[2];
    if (s.includes('igbo')) return LANGUAGES[3];
    if (s.includes('fran') || s.includes('french')) return LANGUAGES[4];
    if (s.includes('swahili') || s.includes('kiswahili')) return LANGUAGES[5];
    return null;
  };

  // ---------- Main conversational loop ----------
  const startSession = async (lang: LangOption) => {
    sessionActive.current = true;
    setLanguage(lang);

    // Greet
    const greeting = lang.greeting;
    setMessages((m) => [...m, { role: 'ai', text: greeting }]);
    setMode('speaking');
    await speak(greeting, lang.ttsCode);

    if (!sessionActive.current) return;
    await conversationLoop(lang);
  };

  const conversationLoop = async (lang: LangOption) => {
    while (sessionActive.current) {
      try {
        // ---- Listen ----
        setMode('listening');
        setLiveText('');
        const uri = await recordUntilSilence({
          silenceThresholdDb: -35,
          silenceDurationMs: 1300,
          maxDurationMs: 20000,
          onLevel: setLevel,
          onStateChange: (s) => {
            if (s === 'listening') setMode('listening');
          },
        });

        if (!sessionActive.current) return;
        if (!uri) {
          // No speech — keep listening
          continue;
        }

        // ---- Transcribe ----
        setMode('thinking');
        const heard = await transcribeAudio(uri, lang.code);
        if (!heard) continue;

        setLiveText(heard);
        setMessages((m) => [...m, { role: 'user', text: heard }]);

        // ---- Stop command? ----
        if (isStopCommand(heard)) {
          const bye = lang.code === 'ha' ? 'Sai an jima.' :
                      lang.code === 'yo' ? 'Ó dàbọ̀.' :
                      lang.code === 'ig' ? 'Ka ọ dị.' :
                      lang.code === 'fr' ? 'Au revoir.' :
                      lang.code === 'sw' ? 'Kwaheri.' :
                      'Goodbye.';
          setMessages((m) => [...m, { role: 'ai', text: bye }]);
          setMode('speaking');
          await speak(bye, lang.ttsCode);
          sessionActive.current = false;
          setMode('paused');
          return;
        }

        // ---- Ask GAIA ----
        const history: ChatTurn[] = messages.slice(-8).map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));

        const reply = await askGaia(heard, lang.code, history);

        // ---- Speak ----
        setMessages((m) => [...m, { role: 'ai', text: reply }]);
        setMode('speaking');
        await speak(reply, lang.ttsCode);

        // Loop continues → listens again
      } catch (e: any) {
        console.log('conversation error', e);
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  };

  // ---------- User taps mic to interrupt/resume ----------
  const onMicPress = async () => {
    if (mode === 'speaking') {
      // Interrupt GAIA
      stopSpeaking();
      return;
    }
    if (mode === 'paused' && language) {
      // Resume conversation
      await startSession(language);
    }
  };

  // ---------- Typed input ----------
  const onTypedSubmit = async () => {
    const text = typedText.trim();
    if (!text || !language) return;
    setTypedText('');
    setTypedMode(false);
    setMessages((m) => [...m, { role: 'user', text }]);
    setMode('thinking');
    try {
      const history: ChatTurn[] = messages.slice(-8).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));
      const reply = await askGaia(text, language.code, history);
      setMessages((m) => [...m, { role: 'ai', text: reply }]);
      setMode('speaking');
      await speak(reply, language.ttsCode);
      if (sessionActive.current && language) {
        await conversationLoop(language);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Try again');
      setMode('paused');
    }
  };

  // ---------- Cleanup on unmount ----------
  useEffect(() => {
    return () => {
      sessionActive.current = false;
      stopSpeaking();
    };
  }, []);

  // ---------- RENDER ----------
  const levelPct = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));

  return (
    <Screen glow="livestock">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              sessionActive.current = false;
              stopSpeaking();
              router.back();
            }}
          >
            <Text style={styles.back}>← EXIT</Text>
          </Pressable>
          <Pill
            label={language ? language.label.toUpperCase() : 'VOICE'}
            color={palette.livestock}
          />
        </View>

        {/* Language picker */}
        {mode === 'pick-language' && (
          <View style={styles.langPicker}>
            <Text style={styles.langQuestion}>
              Which language would you like to be served in?
            </Text>
            <Text style={styles.langSub}>
              Zabi harshe / Yan ede / Họrọ asụsụ / Choose language
            </Text>

            <ScrollView style={{ marginTop: spacing.xl }}>
              {LANGUAGES.map((l) => (
                <Pressable
                  key={l.code}
                  onPress={() => {
                    setLanguage(l);
                    setMode('greeting');
                  }}
                  style={styles.langRow}
                >
                  <Text style={styles.langFlag}>{l.flag}</Text>
                  <Text style={styles.langName}>{l.label}</Text>
                  <Text style={styles.langArrow}>›</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Conversation view */}
        {mode !== 'pick-language' && (
          <>
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

              {liveText !== '' && mode === 'thinking' && (
                <View style={[styles.bubble, styles.bubbleUser, { opacity: 0.6 }]}>
                  <Text style={styles.bubbleTextUser}>{liveText}</Text>
                </View>
              )}

              {mode === 'thinking' && liveText === '' && (
                <View style={[styles.bubble, styles.bubbleAi]}>
                  <ActivityIndicator color={palette.neon} />
                </View>
              )}
            </ScrollView>

            {/* Live level meter */}
            <View style={styles.meterWrap}>
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${mode === 'listening' ? levelPct : 0}%`,
                    backgroundColor: palette.neon,
                  },
                ]}
              />
            </View>

            {/* Status line */}
            <Text style={styles.status}>
              {mode === 'speaking' && 'GAIA is speaking… tap mic to interrupt'}
              {mode === 'listening' && 'Listening… just speak'}
              {mode === 'thinking' && 'Thinking…'}
              {mode === 'paused' && 'Tap the mic to resume'}
              {mode === 'greeting' && 'Starting…'}
            </Text>

            {/* Typed input */}
            {typedMode && (
              <View style={styles.typedRow}>
                <TextInput
                  value={typedText}
                  onChangeText={setTypedText}
                  placeholder="Or type here…"
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

            {/* Controls */}
            <View style={styles.controls}>
              <Pressable
                onPress={() => setTypedMode((v) => !v)}
                style={styles.sideBtn}
              >
                <Text style={styles.sideBtnText}>⌨</Text>
              </Pressable>

              <Pressable onPress={onMicPress} style={[styles.micBtn, {
                backgroundColor:
                  mode === 'listening' ? palette.danger :
                  mode === 'speaking' ? palette.warning :
                  mode === 'thinking' ? palette.textDim :
                  palette.neon,
              }]}>
                <Text style={styles.micIcon}>
                  {mode === 'listening' ? '●' :
                   mode === 'speaking' ? '◼' :
                   mode === 'thinking' ? '···' :
                   '🎙'}
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  sessionActive.current = false;
                  stopSpeaking();
                  setMessages([]);
                  setMode('pick-language');
                }}
                style={styles.sideBtn}
              >
                <Text style={styles.sideBtnText}>↻</Text>
              </Pressable>
            </View>
          </>
        )}
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
  // Language picker
  langPicker: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },
  langQuestion: {
    fontSize: 26,
    fontWeight: '900',
    color: p.text,
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  langSub: {
    fontSize: 13,
    color: p.textMuted,
    marginTop: 12,
    lineHeight: 20,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: 10,
  },
  langFlag: { fontSize: 28 },
  langName: { fontSize: 17, color: p.text, fontWeight: '700', flex: 1 },
  langArrow: { fontSize: 24, color: p.textMuted },
  // Chat
  chat: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  bubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.borderHi,
  },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: p.neon },
  bubbleText: { fontSize: 15, color: p.text, lineHeight: 21 },
  bubbleTextUser: { color: p.obsidian, fontWeight: '600' },
  // Meter
  meterWrap: {
    height: 4,
    backgroundColor: p.surface,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  meterFill: { height: '100%', borderRadius: 2 },
  status: {
    textAlign: 'center',
    fontSize: 12,
    color: p.textMuted,
    paddingVertical: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  typedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  typedInput: {
    flex: 1,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: p.text,
    fontSize: 15,
  },
  typedSend: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: p.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typedSendText: { color: p.obsidian, fontSize: 22, fontWeight: '900' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 24,
  },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnText: { fontSize: 20, color: p.textMuted },
  micBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: p.neon,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  micIcon: { fontSize: 38, color: p.obsidian },
});
