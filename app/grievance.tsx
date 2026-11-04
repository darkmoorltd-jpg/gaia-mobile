import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const CATEGORIES = [
  'Wrong registration data',
  'Agent misconduct',
  'Denied subsidy/loan',
  'Data privacy concern',
  'Account access issue',
  'Other',
];

export default function GrievanceScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data } = await supabase
        .from('grievances')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setRows(data || []);
    } catch {}
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Missing', 'Subject and message required'); return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('grievances').insert({
      user_id: user?.id, category, subject: subject.trim(),
      message: message.trim(), status: 'open',
    });
    setSubmitting(false);
    if (error) Alert.alert('Failed', error.message);
    else {
      Alert.alert('Submitted', 'Your grievance has been logged. The GAIA team will review it.');
      setSubject(''); setMessage(''); load();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>File a Grievance</Text>
        <Text style={styles.sub}>NDFR · Section 6.3.1 · Grievance Redress</Text>

        <Text style={styles.sectionLabel}>NEW GRIEVANCE</Text>
        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.chips}>
          {CATEGORIES.map(c => (
            <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipOn]}>
              <Text style={[styles.chipTxt, category === c && styles.chipTxtOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>SUBJECT</Text>
        <TextInput value={subject} onChangeText={setSubject} style={styles.input} placeholder="Brief summary" placeholderTextColor="#888" />

        <Text style={styles.label}>MESSAGE</Text>
        <TextInput value={message} onChangeText={setMessage} style={[styles.input, { minHeight: 100 }]} multiline placeholder="Describe your issue in detail" placeholderTextColor="#888" />

        <Pressable onPress={submit} disabled={submitting} style={[styles.cta, submitting && { opacity: 0.5 }]}>
          {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>SUBMIT GRIEVANCE</Text>}
        </Pressable>

        <Text style={styles.sectionLabel}>MY GRIEVANCES ({rows.length})</Text>
        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {!busy && rows.length === 0 ? <Text style={styles.empty}>No grievances yet.</Text> : null}
        {rows.map((g) => {
          const statusColor = g.status === 'open' ? '#ffb300' : (g.status === 'resolved' ? '#00ff88' : '#888');
          return (
            <View key={g.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{g.subject}</Text>
                <Text style={[styles.status, { color: statusColor }]}>{g.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.meta}>{g.category} · {new Date(g.created_at).toLocaleDateString()}</Text>
              <Text style={styles.body}>{g.message}</Text>
              {g.resolution ? (
                <View style={styles.resolution}>
                  <Text style={styles.resLbl}>RESOLUTION</Text>
                  <Text style={styles.resTxt}>{g.resolution}</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 20, marginBottom: 10 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  chipOn: { backgroundColor: p.neon, borderColor: p.neon },
  chipTxt: { fontSize: 11, fontWeight: '700', color: p.textMuted },
  chipTxtOn: { color: p.obsidian, fontWeight: '900' },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15, marginBottom: 10 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginTop: 10 },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  empty: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
  card: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: p.text, flex: 1, marginRight: 8 },
  status: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  meta: { fontSize: 11, color: p.textMuted, marginBottom: 6 },
  body: { fontSize: 12, color: p.text, lineHeight: 18 },
  resolution: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: 'rgba(0,255,136,0.08)', borderLeftWidth: 3, borderLeftColor: p.neon },
  resLbl: { fontSize: 9, fontWeight: '900', color: p.neon, letterSpacing: 1, marginBottom: 4 },
  resTxt: { fontSize: 12, color: p.text, lineHeight: 18 },
});
