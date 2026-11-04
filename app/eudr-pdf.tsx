import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function EUDRPDF() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any | null>(null);

  const load = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const { data: batch } = await supabase
      .from('batches')
      .select('*, batch_events(*), batch_movements(*), container_batches(*, containers(*))')
      .eq('batch_code', code.trim().toUpperCase())
      .maybeSingle();

    if (!batch) {
      Alert.alert('Not Found', 'Batch not found');
      setBusy(false);
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, state, lga, phone')
      .eq('user_id', batch.farmer_id)
      .maybeSingle();

    setData({ ...batch, farmer: profile });
    setBusy(false);
  };

  const buildHtml = (b: any) => {
    const farmer = b.farmer || {};
    const farmerName = (farmer.first_name || '') + ' ' + (farmer.last_name || '');
    const container = (b.container_batches || [])[0]?.containers;
    const events = (b.batch_events || []).sort((a: any, x: any) => new Date(a.created_at).getTime() - new Date(x.created_at).getTime());

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Helvetica, Arial, sans-serif; color: #111; padding: 40px; }
  .header { text-align: center; border-bottom: 3px solid #00c853; padding-bottom: 20px; margin-bottom: 30px; }
  .title { font-size: 28px; font-weight: 900; color: #00c853; margin: 0; }
  .subtitle { font-size: 12px; color: #666; margin-top: 6px; letter-spacing: 2px; }
  .badge { display: inline-block; background: #00c853; color: #fff; padding: 6px 16px; border-radius: 20px; font-size: 11px; font-weight: 900; letter-spacing: 1px; margin-top: 12px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 14px; font-weight: 900; color: #00c853; letter-spacing: 1.5px; margin-bottom: 10px; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 8px 0; font-size: 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  td.k { color: #666; width: 35%; }
  td.v { color: #111; font-weight: 600; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #888; text-align: center; }
  .timeline { margin-left: 4px; }
  .timeline-item { padding: 8px 0 8px 16px; border-left: 2px solid #00c853; position: relative; }
  .timeline-item::before { content: ''; position: absolute; left: -6px; top: 12px; width: 10px; height: 10px; background: #00c853; border-radius: 50%; }
  .timeline-type { font-size: 11px; font-weight: 900; color: #00c853; letter-spacing: 1px; }
  .timeline-note { font-size: 11px; color: #333; margin-top: 2px; }
  .timeline-date { font-size: 10px; color: #888; margin-top: 2px; }
</style>
</head>
<body>
  <div class="header">
    <h1 class="title">GAIA</h1>
    <div class="subtitle">EU DEFORESTATION REGULATION · DUE DILIGENCE STATEMENT</div>
    <div class="badge">EUDR COMPLIANT</div>
  </div>

  <div class="section">
    <div class="section-title">BATCH IDENTIFICATION</div>
    <table>
      <tr><td class="k">Batch Code</td><td class="v">${b.batch_code}</td></tr>
      <tr><td class="k">Crop</td><td class="v">${b.crop_name}</td></tr>
      <tr><td class="k">Quantity</td><td class="v">${b.quantity_kg} kg</td></tr>
      <tr><td class="k">Quality Grade</td><td class="v">${b.quality_grade || 'A'}</td></tr>
      <tr><td class="k">Harvest Date</td><td class="v">${b.harvest_date}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">PRODUCER (FARMER)</div>
    <table>
      <tr><td class="k">Name</td><td class="v">${farmerName || '—'}</td></tr>
      <tr><td class="k">State / LGA</td><td class="v">${farmer.state || '—'} / ${farmer.lga || '—'}</td></tr>
      <tr><td class="k">Phone</td><td class="v">${farmer.phone || '—'}</td></tr>
      <tr><td class="k">Farm Location</td><td class="v">${b.location || '—'}</td></tr>
      <tr><td class="k">GPS Coordinates</td><td class="v">${b.gps_lat ? b.gps_lat.toFixed(6) : '—'}, ${b.gps_lon ? b.gps_lon.toFixed(6) : '—'}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">CHAIN OF CUSTODY</div>
    <div class="timeline">
      ${events.map((e: any) => `
        <div class="timeline-item">
          <div class="timeline-type">${(e.event_type || '').toUpperCase()}</div>
          <div class="timeline-note">${e.notes || ''}</div>
          <div class="timeline-date">${new Date(e.created_at).toLocaleString()}</div>
        </div>
      `).join('')}
    </div>
  </div>

  ${container ? `
  <div class="section">
    <div class="section-title">EXPORT DETAILS</div>
    <table>
      <tr><td class="k">Container Number</td><td class="v">${container.container_number}</td></tr>
      <tr><td class="k">Departure Port</td><td class="v">${container.departure_port || '—'}</td></tr>
      <tr><td class="k">Destination</td><td class="v">${container.destination_country || '—'}</td></tr>
      <tr><td class="k">Status</td><td class="v">${(container.status || '').toUpperCase()}</td></tr>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">DECLARATION</div>
    <p style="font-size: 11px; line-height: 1.6; color: #333;">
      The information in this document has been independently verified through the GAIA traceability system. 
      The producer confirms that the commodity described above was produced on the identified plot of land 
      and that no deforestation has occurred on that plot after December 31, 2020, in accordance with 
      Regulation (EU) 2023/1115.
    </p>
  </div>

  <div class="footer">
    Generated by GAIA · Darkmoor Ltd · ${new Date().toISOString().slice(0, 10)}<br>
    Verify at: https://gaia.ng/trace/${b.batch_code}
  </div>
</body>
</html>`;
  };

  const generate = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const html = buildHtml(data);
      const { uri } = await Print.printToFileAsync({ html });
      setBusy(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share EUDR PDF' });
      } else {
        Alert.alert('Generated', 'PDF saved at: ' + uri);
      }
    } catch (e: any) {
      setBusy(false);
      Alert.alert('Failed', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>EUDR Document</Text>
        <Text style={styles.sub}>Generate a real EU Due Diligence Statement.</Text>

        <View style={styles.inputRow}>
          <TextInput value={code} onChangeText={setCode} placeholder="Batch code" placeholderTextColor={palette.textDim} style={[styles.input, { flex: 1 }]} autoCapitalize="characters" />
          <Pressable onPress={load} disabled={busy} style={styles.btn}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>LOAD</Text>}
          </Pressable>
        </View>

        {data ? (
          <View style={styles.preview}>
            <Text style={styles.previewBatch}>{data.batch_code}</Text>
            <Text style={styles.previewMeta}>{data.crop_name} · {data.quantity_kg}kg</Text>
            <Text style={styles.previewMeta}>{(data.farmer?.first_name || '') + ' ' + (data.farmer?.last_name || '')}</Text>
            <Text style={styles.previewMeta}>{data.location}</Text>
            <Text style={styles.previewMeta}>Events: {(data.batch_events || []).length}</Text>
            {data.container_batches?.[0]?.containers ? (
              <Text style={styles.previewMeta}>Container: {data.container_batches[0].containers.container_number}</Text>
            ) : null}

            <Pressable onPress={generate} disabled={busy} style={[styles.btn, { width: '100%', marginTop: 16, backgroundColor: palette.neon }]}>
              <Text style={styles.btnTxt}>📄 GENERATE & SHARE PDF</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  input: { backgroundColor: p.surface, padding: 14, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 15 },
  btn: { backgroundColor: p.neon, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
  preview: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: p.neon },
  previewBatch: { fontSize: 20, fontWeight: '900', color: p.neon, fontFamily: 'monospace', textAlign: 'center' },
  previewMeta: { fontSize: 12, color: p.text, textAlign: 'center', marginTop: 4 },
});
