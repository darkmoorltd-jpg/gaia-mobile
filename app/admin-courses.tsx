import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const API = 'https://gaia-api-xuly.onrender.com';

const LANG_TARGETS = [
  { code: 'ha', label: 'Hausa' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ig', label: 'Igbo' },
  { code: 'pcm', label: 'Pidgin' },
];

export default function AdminCourses() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const styles = createStyles(palette);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState<'analytics' | 'courses'>('analytics');
  const [analytics, setAnalytics] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const [a, c] = await Promise.all([
        supabase.rpc('admin_univ_analytics'),
        supabase.from('courses').select('*').order('sort_order'),
      ]);
      setAnalytics(a.data || {});
      setCourses(c.data || []);
    } catch (e) { console.log(e); }
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.blockedText}>Admin only</Text>
      </View>
    );
  }

  const deleteCourse = (c: any) => {
    Alert.alert('Delete "' + c.title + '"?', 'Removes all lessons and quizzes. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('admin_course_delete', { p_id: c.id });
        if (error) { Alert.alert('Failed', error.message); return; }
        load();
      }},
    ]);
  };

  const newCourse = () => {
    setEditingCourse({
      id: '',
      title: '',
      emoji: '📘',
      description: '',
      level: 'beginner',
      duration_minutes: 60,
      published: true,
      sort_order: 100,
      is_new: true,
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>ADMIN · UNIVERSITY</Text>
        <Text style={styles.title}>Course Manager</Text>
        <Text style={styles.sub}>Create, edit, translate, track</Text>

        <View style={styles.tabs}>
          {(['analytics', 'courses'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                {t === 'analytics' ? 'ANALYTICS' : 'COURSES'}
              </Text>
            </Pressable>
          ))}
        </View>

        {busy && !analytics ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {tab === 'analytics' && analytics ? (
          <>
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <Text style={styles.metricVal}>{analytics.total_enrollments ?? 0}</Text>
                <Text style={styles.metricLbl}>ENROLLMENTS</Text>
              </View>
              <View style={styles.metric}>
                <Text style={[styles.metricVal, { color: '#00ff88' }]}>{analytics.total_completions ?? 0}</Text>
                <Text style={styles.metricLbl}>COMPLETIONS</Text>
              </View>
            </View>
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <Text style={[styles.metricVal, { color: '#ffd700' }]}>{analytics.total_certificates ?? 0}</Text>
                <Text style={styles.metricLbl}>CERTIFICATES</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricVal}>{analytics.total_lesson_completions ?? 0}</Text>
                <Text style={styles.metricLbl}>LESSONS DONE</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>BY COURSE</Text>
            {(analytics.by_course || []).map((c: any, i: number) => (
              <View key={i} style={styles.courseStat}>
                <Text style={styles.courseStatEmoji}>{c.emoji || '📘'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseStatTitle}>{c.course_title}</Text>
                  <Text style={styles.courseStatMeta}>
                    {c.enrolled} enrolled · {c.completed} completed · {c.certificates} certs
                  </Text>
                  <View style={styles.barBg}>
                    <View
                      style={[styles.barFill, {
                        width: (c.enrolled > 0 ? Math.round((c.completed / c.enrolled) * 100) : 0) + '%',
                      }]}
                    />
                  </View>
                </View>
              </View>
            ))}

            <Text style={styles.sectionLabel}>RECENT ENROLLMENTS</Text>
            {(analytics.recent_enrollments || []).slice(0, 15).map((e: any, i: number) => (
              <View key={i} style={styles.recentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentUser} numberOfLines={1}>{e.user_name || e.user_email}</Text>
                  <Text style={styles.recentCourse} numberOfLines={1}>{e.course_title}</Text>
                </View>
                <Text style={styles.recentDate}>{new Date(e.enrolled_at).toLocaleDateString()}</Text>
              </View>
            ))}
          </>
        ) : null}

        {tab === 'courses' ? (
          <>
            <Pressable onPress={newCourse} style={styles.newBtn}>
              <Text style={styles.newBtnText}>+ NEW COURSE</Text>
            </Pressable>

            {courses.map((c) => (
              <View key={c.id} style={styles.courseCard}>
                <View style={styles.courseHead}>
                  <Text style={styles.courseEmoji}>{c.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseTitle}>{c.title}</Text>
                    <Text style={styles.courseMeta}>
                      {c.id} · {c.level} · {c.published ? 'published' : 'DRAFT'}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    onPress={async () => {
                      const r = await supabase.rpc('admin_univ_course_full', { p_course_id: c.id });
                      setEditingCourse({ ...c, is_new: false, ...(r.data || {}) });
                    }}
                    style={[styles.miniBtn, { borderColor: '#4fc3f7' }]}
                  >
                    <Text style={[styles.miniBtnText, { color: '#4fc3f7' }]}>EDIT</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      const r = await supabase.rpc('admin_univ_course_full', { p_course_id: c.id });
                      setEditingQuiz({
                        course_id: c.id,
                        quiz: r.data?.quiz || null,
                        title: r.data?.quiz?.title || (c.title + ' Final Exam'),
                        pass_threshold: r.data?.quiz?.pass_threshold || 80,
                        questions: r.data?.quiz?.questions || [],
                      });
                    }}
                    style={[styles.miniBtn, { borderColor: '#ffb300' }]}
                  >
                    <Text style={[styles.miniBtnText, { color: '#ffb300' }]}>QUIZ</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteCourse(c)} style={[styles.miniBtn, { borderColor: '#ff3b5c' }]}>
                    <Text style={[styles.miniBtnText, { color: '#ff3b5c' }]}>DELETE</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>

      {editingCourse ? (
        <CourseEditorModal
          data={editingCourse}
          onClose={() => setEditingCourse(null)}
          onSaved={() => { setEditingCourse(null); load(); }}
        />
      ) : null}

      {editingQuiz ? (
        <QuizEditorModal
          data={editingQuiz}
          onClose={() => setEditingQuiz(null)}
          onSaved={() => { setEditingQuiz(null); load(); }}
        />
      ) : null}
    </View>
  );
}

// ============================================================
// Course editor with lessons
// ============================================================
function CourseEditorModal({ data, onClose, onSaved }: any) {
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [id, setId] = useState(data.id || '');
  const [title, setTitle] = useState(data.title || '');
  const [emoji, setEmoji] = useState(data.emoji || '📘');
  const [description, setDescription] = useState(data.description || '');
  const [level, setLevel] = useState(data.level || 'beginner');
  const [duration, setDuration] = useState(String(data.duration_minutes || 60));
  const [published, setPublished] = useState(data.published !== false);
  const [sortOrder, setSortOrder] = useState(String(data.sort_order || 100));

  const [lessons, setLessons] = useState<any[]>(data.lessons || []);
  const [busy, setBusy] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);

  const saveCourse = async () => {
    if (!id.trim() || !title.trim()) {
      Alert.alert('Missing fields', 'ID and title are required.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('admin_course_upsert', {
      p_id: id.trim().toLowerCase(),
      p_title: title.trim(),
      p_emoji: emoji,
      p_description: description.trim() || null,
      p_level: level,
      p_duration_minutes: parseInt(duration) || 60,
      p_published: published,
      p_sort_order: parseInt(sortOrder) || 100,
    });
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Saved', 'Course saved. Now add or edit lessons.');
  };

  const deleteLesson = (l: any) => {
    Alert.alert('Delete lesson?', l.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('admin_lesson_delete', { p_id: l.id });
        if (error) { Alert.alert('Failed', error.message); return; }
        setLessons((prev) => prev.filter((x) => x.id !== l.id));
      }},
    ]);
  };

  const translateLesson = async (l: any, target: string) => {
    setTranslating(l.id + '-' + target);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch(API + '/translate', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: l.body, target, context: 'agricultural training lesson for Nigerian farmers' }),
      });
      if (!r.ok) { Alert.alert('Translation failed'); setTranslating(null); return; }
      const j = await r.json();
      const translation = j.translation;
      if (!translation) { Alert.alert('Empty translation'); setTranslating(null); return; }

      // Save directly to the column
      const column = target === 'ha' ? 'body_ha' : target === 'yo' ? 'body_yo' : target === 'ig' ? 'body_ig' : null;
      if (column) {
        const { error } = await supabase.from('course_lessons').update({ [column]: translation }).eq('id', l.id);
        if (error) { Alert.alert('Save failed', error.message); setTranslating(null); return; }
        setLessons((prev) => prev.map((x) => x.id === l.id ? { ...x, [column]: translation } : x));
      }
      Alert.alert('Translated', target.toUpperCase() + ' saved');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Translation failed');
    }
    setTranslating(null);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalSheet}>
          <ScrollView>
            <Text style={styles.modalKicker}>COURSE</Text>
            <Text style={styles.modalTitle}>{data.is_new ? 'New Course' : 'Edit Course'}</Text>

            <Text style={styles.label}>ID (SLUG)</Text>
            <TextInput value={id} onChangeText={setId} editable={data.is_new} style={[styles.input, !data.is_new && { opacity: 0.5 }]} placeholder="maize" autoCapitalize="none" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>TITLE</Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Maize Agronomist" placeholderTextColor={palette.textDim} />

            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>EMOJI</Text>
                <TextInput value={emoji} onChangeText={setEmoji} style={styles.input} maxLength={4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>LEVEL</Text>
                <TextInput value={level} onChangeText={setLevel} style={styles.input} placeholder="beginner" placeholderTextColor={palette.textDim} />
              </View>
            </View>

            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput value={description} onChangeText={setDescription} style={[styles.input, { minHeight: 70 }]} multiline placeholder="Short description" placeholderTextColor={palette.textDim} />

            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>DURATION (MIN)</Text>
                <TextInput value={duration} onChangeText={setDuration} keyboardType="numeric" style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>SORT ORDER</Text>
                <TextInput value={sortOrder} onChangeText={setSortOrder} keyboardType="numeric" style={styles.input} />
              </View>
            </View>

            <Pressable onPress={() => setPublished(!published)} style={styles.checkRow}>
              <View style={[styles.checkBox, published && styles.checkBoxOn]}>
                {published ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkLabel}>Published</Text>
            </Pressable>

            <Pressable onPress={saveCourse} disabled={busy} style={[styles.saveBtn, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>SAVE COURSE</Text>}
            </Pressable>

            {!data.is_new ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 24 }]}>LESSONS ({lessons.length})</Text>
                <Pressable
                  onPress={() => setEditingLesson({ id: null, course_id: id, sort_order: lessons.length + 1, title: '', body: '', estimated_minutes: 5 })}
                  style={[styles.miniBtn, { borderColor: '#00ff88', marginBottom: 12 }]}
                >
                  <Text style={[styles.miniBtnText, { color: '#00ff88' }]}>+ ADD LESSON</Text>
                </Pressable>

                {lessons.map((l) => (
                  <View key={l.id} style={styles.lessonCard}>
                    <View style={styles.lessonHead}>
                      <Text style={styles.lessonOrder}>{l.sort_order}</Text>
                      <Text style={styles.lessonTitle} numberOfLines={1}>{l.title}</Text>
                    </View>
                    <Text style={styles.lessonSnippet} numberOfLines={2}>{l.body}</Text>

                    <View style={styles.transRow}>
                      {LANG_TARGETS.map((t) => {
                        const col = t.code === 'ha' ? 'body_ha' : t.code === 'yo' ? 'body_yo' : t.code === 'ig' ? 'body_ig' : null;
                        const has = col && l[col];
                        const isLoading = translating === l.id + '-' + t.code;
                        return (
                          <Pressable
                            key={t.code}
                            onPress={() => translateLesson(l, t.code)}
                            disabled={!!translating || !col}
                            style={[styles.transChip, has && styles.transChipOn, !col && { opacity: 0.3 }]}
                          >
                            {isLoading ? <ActivityIndicator size="small" color={palette.neon} /> :
                              <Text style={[styles.transChipText, has && styles.transChipTextOn]}>
                                {t.code.toUpperCase()}{has ? ' ✓' : ''}
                              </Text>}
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable onPress={() => setEditingLesson(l)} style={[styles.miniBtn, { borderColor: '#4fc3f7' }]}>
                        <Text style={[styles.miniBtnText, { color: '#4fc3f7' }]}>EDIT</Text>
                      </Pressable>
                      <Pressable onPress={() => deleteLesson(l)} style={[styles.miniBtn, { borderColor: '#ff3b5c' }]}>
                        <Text style={[styles.miniBtnText, { color: '#ff3b5c' }]}>DELETE</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>

          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border, marginTop: 8 }]}>
            <Text style={[styles.closeTxt, { color: palette.text }]}>CLOSE</Text>
          </Pressable>
        </View>
      </View>

      {editingLesson ? (
        <LessonEditorModal
          data={editingLesson}
          onClose={() => setEditingLesson(null)}
          onSaved={async (saved) => {
            // Refresh lessons list
            const r = await supabase.rpc('admin_univ_course_full', { p_course_id: id });
            setLessons(r.data?.lessons || []);
            setEditingLesson(null);
          }}
        />
      ) : null}
    </Modal>
  );
}

function LessonEditorModal({ data, onClose, onSaved }: any) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [title, setTitle] = useState(data.title || '');
  const [body, setBody] = useState(data.body || '');
  const [order, setOrder] = useState(String(data.sort_order || 1));
  const [minutes, setMinutes] = useState(String(data.estimated_minutes || 5));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim() || !body.trim()) { Alert.alert('Title and body required'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('admin_lesson_upsert', {
      p_id: data.id,
      p_course_id: data.course_id,
      p_sort_order: parseInt(order) || 1,
      p_title: title.trim(),
      p_body: body.trim(),
      p_estimated_minutes: parseInt(minutes) || 5,
    });
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    onSaved(true);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalSheet}>
          <ScrollView>
            <Text style={styles.modalKicker}>LESSON</Text>
            <Text style={styles.modalTitle}>{data.id ? 'Edit Lesson' : 'New Lesson'}</Text>

            <Text style={styles.label}>TITLE</Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Lesson title" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>BODY</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              style={[styles.input, { minHeight: 180, textAlignVertical: 'top' }]}
              multiline
              placeholder="Lesson content..."
              placeholderTextColor={palette.textDim}
            />

            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>ORDER</Text>
                <TextInput value={order} onChangeText={setOrder} keyboardType="numeric" style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>MINUTES</Text>
                <TextInput value={minutes} onChangeText={setMinutes} keyboardType="numeric" style={styles.input} />
              </View>
            </View>

            <Pressable onPress={save} disabled={busy} style={[styles.saveBtn, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>SAVE LESSON</Text>}
            </Pressable>
          </ScrollView>

          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border, marginTop: 8 }]}>
            <Text style={[styles.closeTxt, { color: palette.text }]}>CANCEL</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function QuizEditorModal({ data, onClose, onSaved }: any) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [title, setTitle] = useState(data.title);
  const [threshold, setThreshold] = useState(String(data.pass_threshold));
  const [questions, setQuestions] = useState<any[]>(data.questions || []);
  const [busy, setBusy] = useState(false);

  const addQuestion = () => {
    setQuestions([...questions, { q: '', opts: ['', '', '', ''], correct: 0 }]);
  };

  const updateQ = (i: number, patch: any) => {
    setQuestions((prev) => prev.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  };

  const removeQ = (i: number) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    const clean = questions.filter((q) => q.q.trim() && q.opts.every((o: string) => o.trim()));
    if (clean.length === 0) { Alert.alert('No questions', 'Add at least one complete question'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('admin_quiz_upsert', {
      p_course_id: data.course_id,
      p_title: title,
      p_pass_threshold: parseInt(threshold) || 80,
      p_questions: clean,
    });
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    onSaved(true);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalSheet}>
          <ScrollView>
            <Text style={styles.modalKicker}>QUIZ</Text>
            <Text style={styles.modalTitle}>Edit Exam</Text>

            <Text style={styles.label}>TITLE</Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} />

            <Text style={styles.label}>PASS THRESHOLD (%)</Text>
            <TextInput value={threshold} onChangeText={setThreshold} keyboardType="numeric" style={styles.input} />

            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>QUESTIONS ({questions.length})</Text>

            {questions.map((q, qi) => (
              <View key={qi} style={styles.qEditor}>
                <View style={styles.qHead}>
                  <Text style={styles.qNum}>Q{qi + 1}</Text>
                  <Pressable onPress={() => removeQ(qi)}><Text style={styles.qRemove}>REMOVE</Text></Pressable>
                </View>

                <TextInput
                  value={q.q}
                  onChangeText={(v) => updateQ(qi, { q: v })}
                  placeholder="Question text"
                  placeholderTextColor={palette.textDim}
                  style={[styles.input, { marginBottom: 8 }]}
                  multiline
                />

                {q.opts.map((opt: string, oi: number) => (
                  <View key={oi} style={styles.optRowEditor}>
                    <Pressable
                      onPress={() => updateQ(qi, { correct: oi })}
                      style={[styles.radio, q.correct === oi && styles.radioOn]}
                    >
                      {q.correct === oi ? <View style={styles.radioDot} /> : null}
                    </Pressable>
                    <TextInput
                      value={opt}
                      onChangeText={(v) => {
                        const opts = [...q.opts];
                        opts[oi] = v;
                        updateQ(qi, { opts });
                      }}
                      placeholder={'Option ' + String.fromCharCode(65 + oi)}
                      placeholderTextColor={palette.textDim}
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    />
                  </View>
                ))}
              </View>
            ))}

            <Pressable onPress={addQuestion} style={[styles.miniBtn, { borderColor: '#00ff88', marginTop: 10 }]}>
              <Text style={[styles.miniBtnText, { color: '#00ff88' }]}>+ ADD QUESTION</Text>
            </Pressable>

            <Pressable onPress={save} disabled={busy} style={[styles.saveBtn, { marginTop: 20 }, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>SAVE QUIZ</Text>}
            </Pressable>
          </ScrollView>

          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border, marginTop: 8 }]}>
            <Text style={[styles.closeTxt, { color: palette.text }]}>CANCEL</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 18, fontWeight: '900', color: '#ff3b5c' },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  tab: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  tabOn: { backgroundColor: p.neonSoft, borderColor: p.borderHi },
  tabText: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  tabTextOn: { color: p.neon },
  metricRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  metric: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  metricVal: { fontSize: 22, fontWeight: '900', color: p.text },
  metricLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  sectionLabel: { ...typography.micro, color: p.textMuted, marginTop: 20, marginBottom: 10 },
  courseStat: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  courseStatEmoji: { fontSize: 24 },
  courseStatTitle: { fontSize: 13, fontWeight: '800', color: p.text },
  courseStatMeta: { fontSize: 10, color: p.textMuted, marginTop: 2, marginBottom: 6 },
  barBg: { height: 4, backgroundColor: 'rgba(0,255,136,0.15)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: p.neon },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  recentUser: { fontSize: 12, fontWeight: '700', color: p.text },
  recentCourse: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  recentDate: { fontSize: 10, color: p.textDim },
  newBtn: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginBottom: 16 },
  newBtnText: { fontSize: 13, fontWeight: '900', letterSpacing: 1, color: p.obsidian },
  courseCard: { padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  courseHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  courseEmoji: { fontSize: 30 },
  courseTitle: { fontSize: 15, fontWeight: '800', color: p.text },
  courseMeta: { fontSize: 10, color: p.textMuted, marginTop: 3 },
  actionRow: { flexDirection: 'row', gap: 6 },
  miniBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  miniBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, maxHeight: '94%', borderTopWidth: 1, borderColor: p.borderHi },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.neon },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 6, marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: { padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13, marginBottom: 6 },
  twoCol: { flexDirection: 'row', gap: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: p.neon, borderColor: p.neon },
  checkMark: { color: '#000', fontWeight: '900', fontSize: 14 },
  checkLabel: { fontSize: 13, color: p.text },
  saveBtn: { marginTop: 16, padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  saveBtnText: { fontSize: 13, fontWeight: '900', letterSpacing: 1, color: p.obsidian },
  closeBtn: { marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  closeTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: p.obsidian },
  lessonCard: { padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  lessonHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  lessonOrder: { fontSize: 11, fontWeight: '900', color: p.neon, width: 20 },
  lessonTitle: { fontSize: 13, fontWeight: '800', color: p.text, flex: 1 },
  lessonSnippet: { fontSize: 11, color: p.textMuted, marginBottom: 10, lineHeight: 16 },
  transRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  transChip: { flex: 1, padding: 6, borderRadius: 6, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  transChipOn: { borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.1)' },
  transChipText: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  transChipTextOn: { color: '#00ff88' },
  qEditor: { padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  qHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  qNum: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  qRemove: { fontSize: 10, fontWeight: '800', color: '#ff3b5c', letterSpacing: 1 },
  optRowEditor: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: p.borderHi, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: p.neon },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: p.neon },
});
