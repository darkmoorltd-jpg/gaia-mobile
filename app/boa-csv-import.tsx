import { useState } from 'react';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

const HEADERS = [
  'email',
  'facility_ref',
  'facility_amount',
  'outstanding',
  'disbursed_at',
  'next_payment_amount',
  'next_payment_date',
  'status',
  'zone',
  'crop',
  'hectares',
  'trust_score',
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim()));
  return { headers, rows };
}

export default function BoaCsvImport() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      setFileName(asset.name);
      const text = await FileSystem.readAsStringAsync(asset.uri);
      const parsed = parseCSV(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setResult(null);
    } catch (e: any) {
      Alert.alert('File error', e?.message || 'Could not read file');
    }
  };

  const importNow = async () => {
    if (rows.length === 0) {
      Alert.alert('No data', 'Pick a CSV file first.');
      return;
    }
    setBusy(true);
    setResult(null);

    const hIndex: Record<string, number> = {};
    headers.forEach((h, i) => { hIndex[h] = i; });

    const jsonRows = rows.map((r) => {
      const obj: any = {};
      for (const key of HEADERS) {
        if (hIndex[key] !== undefined) {
          obj[key] = r[hIndex[key]] || '';
        }
      }
      return obj;
    });

    const { data, error } = await supabase.rpc('boa_import_loans', { p_rows: jsonRows });
    setBusy(false);
    if (error) {
      Alert.alert('Import failed', error.message);
      return;
    }
    setResult(data);
  };

  const reset = () => {
    setFileName('');
    setHeaders([]);
    setRows([]);
    setResult(null);
  };

  const previewRows = rows.slice(0, 3);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>CSV Import</Text>
        <Text style={styles.sub}>Bulk upload loan book</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>REQUIRED COLUMNS</Text>
          <Text style={styles.infoText}>{HEADERS.join(', ')}</Text>
          <Text style={styles.infoText} style={{ marginTop: 8 }}>
            Only <Text style={{ fontWeight: '900', color: palette.neon }}>email</Text> is required. Others default to safe values.
            Borrowers must already have GAIA accounts.
          </Text>
        </View>

        <Pressable onPress={pickFile} style={styles.pickBtn}>
          <Text style={styles.pickBtnText}>
            {fileName ? 'PICK DIFFERENT FILE' : 'PICK CSV FILE'}
          </Text>
        </Pressable>

        {fileName ? (
          <View style={styles.fileCard}>
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
            <Text style={styles.fileMeta}>{rows.length} rows · {headers.length} columns</Text>
          </View>
        ) : null}

        {previewRows.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>PREVIEW (first 3 rows)</Text>
            {previewRows.map((r, i) => (
              <View key={i} style={styles.previewRow}>
                {r.slice(0, 4).map((c, j) => (
                  <Text key={j} style={styles.previewCell} numberOfLines={1}>{c || '-'}</Text>
                ))}
              </View>
            ))}
          </>
        ) : null}

        {rows.length > 0 ? (
          <Pressable onPress={importNow} disabled={busy} style={[styles.importBtn, busy && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color="#000" /> : (
              <Text style={styles.importBtnText}>IMPORT {rows.length} ROWS</Text>
            )}
          </Pressable>
        ) : null}

        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>IMPORT COMPLETE</Text>
            <View style={styles.resultRow}>
              <View style={styles.resultStat}>
                <Text style={[styles.resultVal, { color: '#00ff88' }]}>{result.ok}</Text>
                <Text style={styles.resultLbl}>IMPORTED</Text>
              </View>
              <View style={styles.resultStat}>
                <Text style={[styles.resultVal, { color: '#ff3b5c' }]}>{result.failed}</Text>
                <Text style={styles.resultLbl}>FAILED</Text>
              </View>
            </View>
            {result.errors && result.errors.length ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.errorLabel}>ERRORS</Text>
                {result.errors.slice(0, 5).map((e: string, i: number) => (
                  <Text key={i} style={styles.errorText}>•  {e}</Text>
                ))}
              </View>
            ) : null}
            <Pressable onPress={reset} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>IMPORT ANOTHER FILE</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  infoBox: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(0,255,136,0.05)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)', marginBottom: 16 },
  infoTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#00ff88', marginBottom: 6 },
  infoText: { fontSize: 11, color: p.textMuted, lineHeight: 17 },
  pickBtn: { padding: 18, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center', marginBottom: 12 },
  pickBtnText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  fileCard: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  fileName: { fontSize: 13, fontWeight: '800', color: p.text },
  fileMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginBottom: 8 },
  previewRow: { flexDirection: 'row', gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  previewCell: { flex: 1, fontSize: 10, color: p.text },
  importBtn: { padding: 18, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center', marginTop: 16 },
  importBtnText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  resultCard: { padding: 20, borderRadius: 18, backgroundColor: p.surface, marginTop: 20, borderWidth: 1, borderColor: '#00ff88' },
  resultTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#00ff88', marginBottom: 12 },
  resultRow: { flexDirection: 'row', gap: 16 },
  resultStat: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.15)' },
  resultVal: { fontSize: 26, fontWeight: '900' },
  resultLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  errorLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#ff3b5c', marginBottom: 6 },
  errorText: { fontSize: 11, color: p.textMuted, marginBottom: 3 },
  resetBtn: { marginTop: 16, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  resetBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: p.text },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
