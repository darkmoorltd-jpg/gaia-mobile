import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Task { id?: number; day: number; month: number; year: number; title: string; note?: string; completed?: boolean }

export default function Calendar() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data } = await supabase
        .from('farm_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('day', { ascending: true });
      setTasks((data as Task[]) || []);
    } catch {}
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = (day: number) => {
    setSelectedDay(day);
    setTitle('');
    setNote('');
    setModalOpen(true);
  };

  const saveTask = async () => {
    if (!user || !title.trim()) return;
    try {
      await supabase.from('farm_tasks').insert({
        user_id: user.id, day: selectedDay, month: month + 1, year, title: title.trim(), note: note.trim() || null,
      });
      setModalOpen(false);
      load();
    } catch {}
  };

  const toggleTask = async (t: Task) => {
    if (!t.id) return;
    try {
      await supabase.from('farm_tasks').update({ completed: !t.completed }).eq('id', t.id);
      load();
    } catch {}
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const tasksForDay = (d: number) => tasks.filter((t) => t.day === d && t.month === month + 1);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>FARMING CALENDAR</Text>
        <Text style={styles.title}>{MONTHS[month]} {year}</Text>

        <View style={styles.monthNav}>
          <Pressable onPress={() => setMonth((m) => (m === 0 ? 11 : m - 1))} style={styles.navBtn}>
            <Text style={styles.navText}>‹</Text>
          </Pressable>
          <Pressable onPress={() => setMonth((m) => (m === 11 ? 0 : m + 1))} style={styles.navBtn}>
            <Text style={styles.navText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          {DAYS.map((d, i) => (<Text key={i} style={styles.dow}>{d}</Text>))}
          {Array.from({ length: firstDay }).map((_, i) => (<View key={'e' + i} style={styles.cell} />))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dt = tasksForDay(d);
            return (
              <Pressable key={d} onPress={() => openAdd(d)} style={[styles.cell, isToday && styles.cellToday]}>
                <Text style={[styles.cellText, isToday && styles.cellTextToday]}>{d}</Text>
                {dt.length > 0 ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>TODAY · {today.getDate()} {MONTHS[month].slice(0, 3)}</Text>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {tasksForDay(today.getDate()).map((t, i) => (
          <Pressable key={i} onPress={() => toggleTask(t)} style={styles.task}>
            <View style={[styles.checkbox, t.completed && styles.checkboxDone]}>
              {t.completed ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskTitle, t.completed && styles.taskTitleDone]}>{t.title}</Text>
              {t.note ? <Text style={styles.taskNote}>{t.note}</Text> : null}
            </View>
          </Pressable>
        ))}
        {!busy && tasksForDay(today.getDate()).length === 0 ? (
          <Text style={styles.empty}>No tasks today. Tap a day to add one.</Text>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setModalOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New task for {selectedDay} {MONTHS[month]}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Task title (e.g. Plant maize)"
              placeholderTextColor={palette.textDim}
              style={styles.modalInput}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note"
              placeholderTextColor={palette.textDim}
              style={styles.modalInput}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable onPress={() => setModalOpen(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable onPress={saveTask} style={styles.modalSave}>
                <Text style={styles.modalSaveText}>SAVE</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  monthNav: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 16 },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 22, color: p.neon, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dow: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 8 },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  cellToday: { backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi },
  cellText: { fontSize: 14, color: p.text, fontWeight: '600' },
  cellTextToday: { color: p.neon, fontWeight: '900' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: p.neon, marginTop: 2 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  task: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border, marginBottom: 8,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 1.5, borderColor: p.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: p.neon, borderColor: p.neon },
  checkMark: { color: p.obsidian, fontWeight: '900', fontSize: 14 },
  taskTitle: { fontSize: 15, color: p.text, fontWeight: '700' },
  taskTitleDone: { textDecorationLine: 'line-through', color: p.textMuted },
  taskNote: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderTopWidth: 1, borderColor: p.borderHi,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: p.text, marginBottom: 16 },
  modalInput: {
    borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: p.text, fontSize: 15, marginBottom: 10,
  },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: p.border, alignItems: 'center',
  },
  modalCancelText: { fontSize: 12, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  modalSave: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: p.neon, alignItems: 'center',
  },
  modalSaveText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
