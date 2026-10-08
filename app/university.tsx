import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, ActivityIndicator,
  Alert, RefreshControl, Share,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const API = 'https://gaia-api-xuly.onrender.com';

interface Course {
  id: string; title: string; emoji: string; description: string;
  level: string; duration_minutes: number; lesson_count: number;
  done_count: number; completed: boolean; certificate_id: string | null;
}
interface Lesson {
  id: string; sort_order: number; title: string; body: string;
  video_url?: string; image_url?: string; estimated_minutes: number; completed: boolean;
}
interface Quiz {
  id: string; title: string; pass_threshold: number;
  questions: { q: string; opts: string[] }[];
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ha', label: 'Hausa' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ig', label: 'Igbo' },
];

export default function University() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const styles = createStyles(palette);

  const [catalog, setCatalog] = useState<Course[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [lang, setLang] = useState('en');
  const [track, setTrack] = useState<'farmer' | 'officer'>('farmer');

  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonsBusy, setLessonsBusy] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [showCerts, setShowCerts] = useState(false);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizBusy, setQuizBusy] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);

  const [audioLoading, setAudioLoading] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const [c, certs] = await Promise.all([
        supabase.rpc('univ_catalog_v2', { p_track: track }),
        supabase.rpc('univ_my_certificates'),
      ]);
      setCatalog(c.data || []);
      setCertificates(certs.data || []);
    } catch (e) { console.log(e); }
    setBusy(false);
    setRef(false);
  }, [user]);

  useFocusEffect(useCallback(() => { loadCatalog(); }, [loadCatalog]));
  useEffect(() => { loadCatalog(); }, [track]);

  const openCourse = async (c: Course) => {
    setActiveCourse(c);
    setLessonsBusy(true);
    const r = await supabase.rpc('univ_lessons', { p_course_id: c.id, p_language: lang });
    setLessons(r.data || []);
    setLessonsBusy(false);
  };

  const markComplete = async (l: Lesson) => {
    if (!activeCourse) return;
    await supabase.rpc('univ_mark_lesson', {
      p_lesson_id: l.id,
      p_course_id: activeCourse.id,
      p_seconds: 60,
    });
    setLessons((prev) => prev.map((x) => x.id === l.id ? { ...x, completed: true } : x));
    setActiveLesson(null);
    loadCatalog();
  };

  const playLessonAudio = async (text: string) => {
    if (!user) return;
    setAudioLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const langCode = lang === 'en' ? 'en' : lang;
      const r = await fetch(API + '/tts', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 2000), language: langCode }),
      });
      if (!r.ok) { Alert.alert('Voice unavailable'); setAudioLoading(false); return; }
      const blob = await r.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        const base64 = dataUri.split(',')[1];
        const path = (require('expo-file-system/legacy')).cacheDirectory + 'lesson_' + Date.now() + '.mp3';
        const FS = require('expo-file-system/legacy');
        await FS.writeAsStringAsync(path, base64, { encoding: FS.EncodingType.Base64 });
        const { createAudioPlayer } = require('expo-audio');
        const player = createAudioPlayer({ uri: path });
        player.play();
        setAudioLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      setAudioLoading(false);
      Alert.alert('Voice unavailable');
    }
  };

  const startQuiz = async () => {
    if (!activeCourse) return;
    setQuizBusy(true);
    const r = await supabase.rpc('univ_quiz', { p_course_id: activeCourse.id });
    setQuizBusy(false);
    if (r.error || !r.data) {
      Alert.alert('No quiz', 'This course has no quiz yet.');
      return;
    }
    setQuiz(r.data);
    setQuizAnswers(new Array(r.data.questions.length).fill(-1));
    setQuizResult(null);
  };

  const submitQuiz = async () => {
    if (!quiz || quizAnswers.includes(-1)) {
      Alert.alert('Answer all questions first');
      return;
    }
    if (!activeCourse) return;
    setQuizBusy(true);
    const r = await supabase.rpc('univ_submit_quiz', {
      p_course_id: activeCourse.id,
      p_answers: quizAnswers,
    });
    setQuizBusy(false);
    if (r.error) { Alert.alert('Failed', r.error.message); return; }
    setQuizResult(r.data);
    loadCatalog();
  };

  const shareCertificate = async (cert: any) => {
    const url = 'https://pxvtvuwlpzwlkdoxjrep.supabase.co/functions/v1/verify?cert=' + cert.id;
    await Share.share({
      message: 'I completed ' + cert.course_title + ' at GAIA University! Certificate ' + cert.id + '\nVerify: ' + url,
    });
  };

  const progressOf = (c: Course) => c.lesson_count > 0 ? Math.round((c.done_count / c.lesson_count) * 100) : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); loadCatalog(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>GAIA UNIVERSITY</Text>
        <Text style={styles.title}>Learn farming</Text>
        <Text style={styles.subtitle}>Free practical courses · earns certificates</Text>

        <View style={styles.trackRow}>
          {(['farmer','officer'] as const).map((tr) => (
            <Pressable key={tr} onPress={() => setTrack(tr)} style={[styles.trackChip, track === tr && styles.trackChipOn]}>
              <Text style={[styles.trackChipText, track === tr && styles.trackChipTextOn]}>
                {tr === 'farmer' ? 'FARMER TRACK' : 'OFFICER TRACK'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.langRow}>
          {LANGUAGES.map((l) => (
            <Pressable key={l.code} onPress={() => setLang(l.code)} style={[styles.langChip, lang === l.code && styles.langChipOn]}>
              <Text style={[styles.langChipText, lang === l.code && styles.langChipTextOn]}>{l.label}</Text>
            </Pressable>
          ))}
        </View>

        {certificates.length > 0 ? (
          <Pressable onPress={() => setShowCerts(true)} style={styles.certBar}>
            <Text style={styles.certBarIcon}>🏅</Text>
            <Text style={styles.certBarText}>{certificates.length} certificate{certificates.length === 1 ? '' : 's'} earned</Text>
            <Text style={styles.certBarArrow}>›</Text>
          </Pressable>
        ) : null}

        {busy && catalog.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {catalog.map((c) => {
          const pct = progressOf(c);
          return (
            <Pressable key={c.id} onPress={() => openCourse(c)} style={styles.courseCard}>
              <Text style={styles.courseEmoji}>{c.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.courseTitle}>{c.title}</Text>
                <Text style={styles.courseModules}>{c.lesson_count} lessons · {c.duration_minutes} min · {c.level}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: String(pct) + '%' as any, backgroundColor: c.completed ? '#00ff88' : palette.neon }]} />
                </View>
                <Text style={styles.courseProgress}>
                  {c.completed ? '✓ COMPLETED' : pct + '% complete'} · {c.done_count}/{c.lesson_count}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Course lesson list */}
      <Modal visible={!!activeCourse && !activeLesson && !quiz} transparent animationType="slide" onRequestClose={() => setActiveCourse(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalKicker}>COURSE</Text>
            <Text style={styles.modalTitle}>{activeCourse?.emoji}  {activeCourse?.title}</Text>

            {lessonsBusy ? <ActivityIndicator color={palette.neon} /> : (
              <ScrollView>
                {lessons.map((l, i) => (
                  <Pressable key={l.id} onPress={() => setActiveLesson(l)} style={styles.lessonRow}>
                    <Text style={[styles.lessonIndex, l.completed && { color: palette.neon }]}>
                      {l.completed ? '✓' : String(i + 1)}
                    </Text>
                    <Text style={styles.lessonTitle}>{l.title}</Text>
                    <Text style={styles.lessonMeta}>{l.estimated_minutes}m</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {activeCourse && activeCourse.lesson_count > 0 && activeCourse.done_count >= activeCourse.lesson_count ? (
              <Pressable onPress={startQuiz} disabled={quizBusy} style={[styles.closeBtn, { backgroundColor: '#ffb300' }]}>
                {quizBusy ? <ActivityIndicator color="#000" /> : <Text style={styles.closeTxt}>TAKE FINAL EXAM</Text>}
              </Pressable>
            ) : null}

            {activeCourse?.completed && activeCourse.certificate_id ? (
              <Pressable
                onPress={() => {
                  const cert = certificates.find((x) => x.id === activeCourse.certificate_id);
                  if (cert) shareCertificate(cert);
                }}
                style={[styles.closeBtn, { backgroundColor: '#00c853', marginTop: 8 }]}
              >
                <Text style={styles.closeTxt}>SHARE CERTIFICATE</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={() => { const cid = activeCourse?.id; setActiveCourse(null); router.push(('/course-live?course=' + cid) as any); }} style={[styles.closeBtn, { backgroundColor: '#7c4dff', marginTop: 8 }]}>
              <Text style={styles.closeTxt}>LIVE CLASSES</Text>
            </Pressable>
            <Pressable onPress={() => setActiveCourse(null)} style={[styles.closeBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border, marginTop: 8 }]}>
              <Text style={[styles.closeTxt, { color: palette.text }]}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Lesson content */}
      <Modal visible={!!activeLesson} transparent animationType="slide" onRequestClose={() => setActiveLesson(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalKicker}>LESSON</Text>
            <Text style={styles.modalTitle}>{activeLesson?.title}</Text>

            <ScrollView style={{ marginTop: 12, maxHeight: 400 }}>
              <Text style={styles.lessonBody}>{activeLesson?.body}</Text>
            </ScrollView>

            <Pressable onPress={() => activeLesson && playLessonAudio(activeLesson.body)} disabled={audioLoading} style={[styles.closeBtn, { backgroundColor: '#4fc3f7', marginTop: 16 }]}>
              {audioLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.closeTxt}>LISTEN</Text>}
            </Pressable>

            {activeLesson?.completed ? (
              <View style={[styles.closeBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.neon, marginTop: 8 }]}>
                <Text style={[styles.closeTxt, { color: palette.neon }]}>ALREADY COMPLETED</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => { if (activeLesson) markComplete(activeLesson); }}
                style={[styles.closeBtn, { marginTop: 8 }]}
              >
                <Text style={styles.closeTxt}>MARK COMPLETE</Text>
              </Pressable>
            )}

            <Pressable onPress={() => setActiveLesson(null)} style={[styles.closeBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border, marginTop: 8 }]}>
              <Text style={[styles.closeTxt, { color: palette.text }]}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Quiz modal */}
      <Modal visible={!!quiz} transparent animationType="slide" onRequestClose={() => { setQuiz(null); setQuizResult(null); }}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalKicker}>FINAL EXAM</Text>
              <Text style={styles.modalTitle}>{quiz?.title}</Text>
              <Text style={styles.quizMeta}>Pass mark: {quiz?.pass_threshold}%</Text>

              {quizResult ? (
                <View style={[styles.resultBox, { borderColor: quizResult.passed ? '#00ff88' : '#ff3b5c' }]}>
                  <Text style={[styles.resultScore, { color: quizResult.passed ? '#00ff88' : '#ff3b5c' }]}>
                    {quizResult.score}%
                  </Text>
                  <Text style={styles.resultLabel}>
                    {quizResult.passed ? 'PASSED' : 'NOT PASSED'}
                  </Text>
                  <Text style={styles.resultDetail}>
                    {quizResult.correct} of {quizResult.total} correct
                  </Text>
                  {quizResult.certificate_id ? (
                    <Text style={styles.certId}>Certificate: {quizResult.certificate_id}</Text>
                  ) : null}
                </View>
              ) : (
                <>
                  {quiz?.questions.map((qq, qi) => (
                    <View key={qi} style={styles.qBlock}>
                      <Text style={styles.qText}>{qi + 1}. {qq.q}</Text>
                      {qq.opts.map((opt, oi) => (
                        <Pressable
                          key={oi}
                          onPress={() => {
                            const next = [...quizAnswers];
                            next[qi] = oi;
                            setQuizAnswers(next);
                          }}
                          style={[styles.optRow, quizAnswers[qi] === oi && styles.optRowOn]}
                        >
                          <View style={[styles.radio, quizAnswers[qi] === oi && styles.radioOn]} />
                          <Text style={styles.optText}>{opt}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>

            {quizResult ? (
              <Pressable onPress={() => { setQuiz(null); setQuizResult(null); loadCatalog(); }} style={styles.closeBtn}>
                <Text style={styles.closeTxt}>DONE</Text>
              </Pressable>
            ) : (
              <Pressable onPress={submitQuiz} disabled={quizBusy} style={styles.closeBtn}>
                {quizBusy ? <ActivityIndicator color="#000" /> : <Text style={styles.closeTxt}>SUBMIT ANSWERS</Text>}
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* Certificates modal */}
      <Modal visible={showCerts} transparent animationType="slide" onRequestClose={() => setShowCerts(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalKicker}>MY CERTIFICATES</Text>
            <Text style={styles.modalTitle}>🏅 Achievements</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {certificates.map((cert) => (
                <View key={cert.id} style={styles.certCard}>
                  <Text style={styles.certEmoji}>{cert.course_emoji || '📘'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.certTitle}>{cert.course_title}</Text>
                    <Text style={styles.certScore}>Score: {cert.final_score}%</Text>
                    <Text style={styles.certIdSmall}>ID: {cert.id}</Text>
                    <Text style={styles.certDate}>{new Date(cert.issued_at).toLocaleDateString()}</Text>
                  </View>
                  <Pressable onPress={() => shareCertificate(cert)} style={styles.certShare}>
                    <Text style={styles.certShareText}>SHARE</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={() => setShowCerts(false)} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  trackRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  trackChip: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  trackChipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  trackChipText: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1.5 },
  trackChipTextOn: { color: p.neon },
  langRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  langChip: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  langChipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  langChipText: { fontSize: 11, fontWeight: '800', color: p.textMuted },
  langChipTextOn: { color: p.neon },
  certBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,215,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', marginBottom: 16 },
  certBarIcon: { fontSize: 22 },
  certBarText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#ffd700' },
  certBarArrow: { fontSize: 20, color: '#ffd700' },
  courseCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  courseEmoji: { fontSize: 34 },
  courseTitle: { fontSize: 15, fontWeight: '800', color: p.text },
  courseModules: { fontSize: 10, color: p.textMuted, marginTop: 2, marginBottom: 8 },
  barBg: { height: 4, backgroundColor: 'rgba(0,255,136,0.15)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: p.neon },
  courseProgress: { fontSize: 10, color: p.textMuted, marginTop: 4 },
  chevron: { fontSize: 24, color: p.textDim },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, maxHeight: '92%', borderTopWidth: 1, borderColor: p.borderHi },
  modalKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.neon },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 6, marginBottom: 16 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: p.border },
  lessonIndex: { fontSize: 14, fontWeight: '900', color: p.textDim, width: 24 },
  lessonTitle: { fontSize: 14, color: p.text, fontWeight: '600', flex: 1 },
  lessonMeta: { fontSize: 10, color: p.textMuted },
  lessonBody: { fontSize: 15, lineHeight: 24, color: '#ddd' },
  closeBtn: { marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  closeTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  quizMeta: { fontSize: 12, color: p.textMuted, marginBottom: 16 },
  qBlock: { marginBottom: 20 },
  qText: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 10 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 6 },
  optRowOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.08)' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: p.border },
  radioOn: { borderColor: p.neon, backgroundColor: p.neon },
  optText: { fontSize: 13, color: p.text, flex: 1 },
  resultBox: { padding: 24, borderRadius: 16, borderWidth: 2, alignItems: 'center', marginTop: 16 },
  resultScore: { fontSize: 48, fontWeight: '900', letterSpacing: -2 },
  resultLabel: { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 2, marginTop: 4 },
  resultDetail: { fontSize: 12, color: p.textMuted, marginTop: 8 },
  certId: { fontSize: 10, color: p.textDim, marginTop: 12, fontFamily: 'monospace' },
  certCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,215,0,0.06)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', marginBottom: 10 },
  certEmoji: { fontSize: 28 },
  certTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
  certScore: { fontSize: 11, color: '#00ff88', marginTop: 2 },
  certIdSmall: { fontSize: 9, color: p.textDim, marginTop: 4, fontFamily: 'monospace' },
  certDate: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  certShare: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#ffd700' },
  certShareText: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
