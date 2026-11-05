import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function AdminStateSync() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [stateName, setStateName] = useState('Kaduna');
  const [sourceName, setSourceName] = useState('OGFIMS');
  const [file, setFile] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [imports, setImports] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('state_imports').select('*').order('started_at', { ascending: false }).limit(20);
    setImports(data || []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] });
    if (!r.canceled && r.assets[0]) setFile(r.assets[0]);
  };

  const upload = async () => {
    if (!file) { Alert.alert('Pick a file first'); return; }
    setBusy(true);
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      if (!token) throw new Error('Not logged in');

      const r = await FileSystem.uploadAsync(API_BASE + '/admin/state-import', file.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: file.mimeType || 'text/csv',
        headers: { Authorization: 'Bearer ' + token },
        parameters: { state_name: stateName, source_name: sourceName },
      });
      if (r.status < 200 || r.status >= 300) {
        throw new Error('HTTP ' + r.status + ' ' + (r.body || '').slice(0, 200));
      }
      const data = JSON.parse(r.body || '{}');
      Alert.alert('Imported',
        `Total: ${data.total}\nInserted: ${data.inserted}\nSkipped dups: ${data.skipped_duplicates}\nFailed: ${data.failed}`);
      setFile(null);
      load();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>State Registry Sync</Text>
        <Text style={styles.sub}>NDFR Section 8.3 · Ingest state farmer CSVs</Text>

        <Text style={styles.label}>STATE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
          {NIGERIAN_STATES.map(s => (
            <Pressable key={s} onPress={() => setStateName(s)} style={[styles.chip, stateName === s && styles.chipOn]}>
              <Text style={[styles.chipTxt, stateName === s && styles.chipTxtOn]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>SOURCE (e.g. OGFIMS, Kaduna Registry)</Text>
        <TextInput value={sourceName} onChangeText={setSourceName} style={styles.input} placeholderTextColor="#888" />

        <Text style={styles.label}>CSV / EXCEL FILE</Text>
        <Pressable onPress={pick} style={styles.pick}>
          <Text style={styles.pickTxt}>{file ? '📎 ' + file.name : '📤 Pick File'}</Text>
        </Pressable>

        <Pressable onPress={upload} disabled={busy || !file} style={[styles.cta, (busy || !file) && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>IMPORT & DEDUP</Text>}
        </Pressable>

        <Text style={styles.label}>RECENT IMPORTS</Text>
        {imports.length === 0 ? <Text style={styles.empty}>None yet.</Text> : null}
        {imports.map((i) => (
          <View key={i.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.name}>{i.state_name} · {i.source_name}</Text>
              <Text style={styles.chip2}>{i.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.meta}>
              {i.total_rows} total · {i.inserted} new · {i.skipped_duplicates} dups · {i.failed} failed
            </Text>
            <Text style={styles.meta}>{new Date(i.started_at).toLocaleString()}</Text>
          </View>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  chipOn: { backgroundColor: p.neon, borderColor: p.neon },
  chipTxt: { fontSize: 11, fontWeight: '700', color: p.textMuted },
  chipTxtOn: { color: p.obsidian, fontWeight: '900' },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  pick: { padding: 16, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: p.neon, alignItems: 'center', marginTop: 4 },
  pickTxt: { fontSize: 13, fontWeight: '700', color: p.neon },
  cta: { marginTop: 16, padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  card: { padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  name: { fontSize: 13, fontWeight: '800', color: p.text, flex: 1 },
  chip2: { fontSize: 9, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  empty: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', paddingVertical: 10 },
});
