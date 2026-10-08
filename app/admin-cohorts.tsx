import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal, Share,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

function fmt(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminCohorts() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const styles = createStyles(palette);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [cohorts, setCohorts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const [c, co] = await Promise.all([
        supabase.rpc('admin_cohort_list'),
        supabase.from('courses').select('id,title,emoji,is_officer_track').order('sort_order'),
      ]);
      setCohorts(c.data || []);
      setCourses(co.data || []);
    } catch (e) { console.log(e); }
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isAdmin) return <View style={styles.center}><Text style={styles.blocked}>Admin only</Text></View>;

  const cancel = (c: any) => {
    Alert.alert('Cancel cohort?', c.title, [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel it', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('admin_cohort_cancel', { p_id: c.id });
        if (error) { Alert.alert('Failed', error.message); return; }
        load();
      }},
    ]);
  };

  const shareRoom = async (c: any) => {
    if (!c.meeting_room_id) return;
    await Share.share({
      message: 'GAIA University class "' + c.title + '" — join: https://meet.jit.si/' + c.meeting_room_id,
    });
  };

  const now = Date.now();
  const upcoming = cohorts.filter((c) => new Date(c.scheduled_for).getTime() > now && c.status === 'scheduled');
  const past = cohorts.filter((c) => new Date(c.scheduled_for).getTime() <= now || c.status !== 'scheduled');

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>ADMIN · LIVE CLASSES</Text>
        <Text style={styles.title}>Cohorts</Text>
        <Text style={styles.sub}>{upcoming.length} upcoming · {past.length} past</Text>

        <Pressable onPress={() => setShowNew(true)} style={styles.newBtn}>
          <Text style={styles.newBtnText}>+ SCHEDULE CLASS</Text>
        </Pressable>

        {busy && cohorts.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        <Text style={styles.sectionLabel}>UPCOMING ({upcoming.length})</Text>
        {upcoming.length === 0 ? <Text style={styles.empty}>No upcoming classes.</Text> : null}
        {upcoming.map((c) => (
          <View key={c.id} style={styles.card}>
            <Text style={styles.cardCourse}>{c.course_title || c.course_id}</Text>
            <Text style={styles.cardTitle}>{c.title}</Text>
            <Text style={styles.cardMeta}>{fmt(c.scheduled_for)} · {c.duration_minutes} min</Text>
            <Text style={styles.cardMeta}>👥 {c.attendees}/{c.max_attendees} registered</Text>
            <View style={styles.row}>
              <Pressable onPress={() => router.push(('/meet-room?room=' + (c.meeting_room_id || '')) as any)} style={[styles.miniBtn, { borderColor: palette.neon }]}>
                <Text style={[styles.miniBtnText, { color: palette.neon }]}>OPEN ROOM</Text>
              </Pressable>
              <Pressable onPress={() => shareRoom(c)} style={[styles.miniBtn, { borderColor: '#4fc3f7' }]}>
                <Text style={[styles.miniBtnText, { color: '#4fc3f7' }]}>SHARE LINK</Text>
              </Pressable>
              <Pressable onPress={() => cancel(c)} style={[styles.miniBtn, { borderColor: '#ff3b5c' }]}>
                <Text style={[styles.miniBtnText, { color: '#ff3b5c' }]}>CANCEL</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Text style={styles.sectionLabel}>PAST / CANCELLED ({past.length})</Text>
        {past.map((c) => (
          <View key={c.id} style={[styles.card, { opacity: 0.7 }]}>
            <Text style={styles.cardCourse}>{c.course_title || c.course_id}</Text>
            <Text style={styles.cardTitle}>{c.title}</Text>
            <Text style={styles.cardMeta}>{fmt(c.scheduled_for)} · {c.status} · {c.attendees} attended</Text>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>

      {showNew ? (
        <NewCohortModal
          courses={courses}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(); }}
        />
      ) : null}
    </View>
  );
}

function NewCohortModal({ courses, onClose, onCreated }: any) {
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [duration, setDuration] = useState('60');
  const [maxAtt, setMaxAtt] = useState('100');
  const [busy, setBusy] = useState(false);

  const schedule = async () => {
    if (!courseId || !title.trim() || !dateStr || !timeStr) {
      Alert.alert('Missing fields', 'Course, title, date and time are required.');
      return;
    }
    // Parse: expect YYYY-MM-DD + HH:MM
    const iso = dateStr + 'T' + timeStr + ':00';
    const when = new Date(iso);
    if (isNaN(when.getTime())) {
      Alert.alert('Invalid date', 'Use format YYYY-MM-DD and HH:MM (24h).');
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.rpc('admin_cohort_create', {
      p_course_id: courseId,
      p_title: title.trim(),
      p_description: desc.trim() || null,
      p_scheduled_for: when.toISOString(),
      p_duration_minutes: parseInt(duration) || 60,
      p_max_attendees: parseInt(maxAtt) || 100,
    });
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Scheduled', 'Meet room: ' + (data?.meeting_room_id || ''));
    onCreated();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalSheet}>
          <ScrollView>
            <Text style={styles.modalKicker}>NEW COHORT</Text>
            <Text style={styles.modalTitle}>Schedule a Live Class</Text>

            <Text style={styles.label}>COURSE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {courses.map((c: any) => (
                <Pressable key={c.id} onPress={() => setCourseId(c.id)} style={[styles.chip, courseId === c.id && styles.chipOn]}>
                  <Text style={[styles.chipText, courseId === c.id && styles.chipTextOn]}>{c.emoji} {c.title}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>TITLE</Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Week 3 Q&A — Fall Armyworm" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput value={desc} onChangeText={setDesc} style={[styles.input, { minHeight: 70 }]} multiline placeholder="What will we cover?" placeholderTextColor={palette.textDim} />

            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>DATE (YYYY-MM-DD)</Text>
                <TextInput value={dateStr} onChangeText={setDateStr} style={styles.input} placeholder="2026-10-15" placeholderTextColor={palette.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>TIME (HH:MM)</Text>
                <TextInput value={timeStr} onChangeText={setTimeStr} style={styles.input} placeholder="14:00" placeholderTextColor={palette.textDim} />
              </View>
            </View>

            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>DURATION (MIN)</Text>
                <TextInput value={duration} onChangeText={setDuration} keyboardType="numeric" style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>MAX ATTENDEES</Text>
                <TextInput value={maxAtt} onChangeText={setMaxAtt} keyboardType="numeric" style={styles.input} />
              </View>
            </View>

            <Pressable onPress={schedule} disabled={busy} style={[styles.saveBtn, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>CREATE + GENERATE ROOM</Text>}
            </Pressable>
          </ScrollView>

          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>CANCEL</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blocked: { fontSize: 18, fontWeight: '900', color: '#ff3b5c' },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  newBtn: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginBottom: 16 },
  newBtnText: { fontSize: 13, fontWeight: '900', letterSpacing: 1, color: p.obsidian },
  sectionLabel: { ...typography.micro, color: p.textMuted, marginTop: 16, marginBottom: 10 },
  empty: { fontSize: 12, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardCourse: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.neon, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: p.text },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  row: { flexDirection: 'row', gap: 6, marginTop: 12 },
  miniBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  miniBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, maxHeight: '94%', borderTopWidth: 1, borderColor: p.borderHi },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.neon },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 6, marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  chipRow: { gap: 6, paddingRight: 16, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textMuted },
  chipTextOn: { color: p.neon },
  input: { padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 13, marginBottom: 6 },
  twoCol: { flexDirection: 'row', gap: 10 },
  saveBtn: { marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  saveBtnText: { fontSize: 13, fontWeight: '900', letterSpacing: 1, color: p.obsidian },
  closeBtn: { marginTop: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  closeTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: p.text },
});
