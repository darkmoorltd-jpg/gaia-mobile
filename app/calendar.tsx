import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Task { id?: string; day: number; month: number; title: string; note?: string }

export default function Calendar() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [tasks, setTasks] = useState<Task[]>([
    { day: 17, month: 8, title: 'Plant maize', note: 'Optimal 6am-9am' },
    { day: 17, month: 8, title: 'Water crops', note: '12mm rain predicted' },
    { day: 20, month: 8, title: 'Apply NPK', note: '2kg/acre' },
  ]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const { data } = await supabase.from('farm_tasks').select('*').eq('user_id', user.id);
        if (data && data.length) setTasks(data as any);
      } catch {}
    })();
  }, [user]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const addTask = async (day: number) => {
    const title = 'New task';
    const t: Task = { day, month: month + 1, title };
    setTasks((prev) => [...prev, t]);
    if (user) {
      try {
        await supabase.from('farm_tasks').insert({
          user_id: user.id,
          day,
          month: month + 1,
          year,
          title,
        });
      } catch {}
    }
  };

  const tasksForDay = (d: number) =>
    tasks.filter((t) => t.day === d && t.month === month + 1);

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
          {DAYS.map((d, i) => (
            <Text key={i} style={styles.dow}>{d}</Text>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <View key={'e' + i} style={styles.cell} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dayTasks = tasksForDay(d);
            return (
              <Pressable key={d} onPress={() => addTask(d)} style={[styles.cell, isToday && styles.cellToday]}>
                <Text style={[styles.cellText, isToday && styles.cellTextToday]}>{d}</Text>
                {dayTasks.length > 0 ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>TODAY</Text>
        {tasksForDay(today.getDate()).map((t, i) => (
          <View key={i} style={styles.task}>
            <Text style={styles.taskTitle}>{t.title}</Text>
            {t.note ? <Text style={styles.taskNote}>{t.note}</Text> : null}
          </View>
        ))}
        {tasksForDay(today.getDate()).length === 0 ? (
          <Text style={styles.empty}>No tasks. Tap a day to add one.</Text>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
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
  task: { padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  taskTitle: { fontSize: 15, color: p.text, fontWeight: '700' },
  taskNote: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
});
