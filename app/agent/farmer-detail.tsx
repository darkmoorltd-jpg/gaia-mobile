import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Image, Linking, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

export default function AgentFarmerDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    const { data: resp, error: err } = await supabase.rpc('agent_farmer_detail', { p_farmer_id: id });
    if (err) {
      setError(err.message);
    } else {
      setData(resp);
    }
    setBusy(false);
  }, [id]);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (busy && !data) return <View style={styles.center}><ActivityIndicator size="large" color={palette.neon} /></View>;
  if (error) return (
    <View style={styles.center}>
      <Text style={styles.errorTxt}>{error}</Text>
      <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backBtnTxt}>GO BACK</Text></Pressable>
    </View>
  );
  if (!data) return <View style={styles.center}><Text style={styles.errorTxt}>Not found</Text></View>;

  const f = data.farmer || {};
  const v = data.verification || {};
  const scans = data.scans || [];
  const counts = data.scan_counts || {};
  const ndvi = data.ndvi || {};
  const batches = data.batches || [];
  const age = f.date_of_birth ? Math.floor((Date.now() - new Date(f.date_of_birth).getTime()) / (365.25 * 86400000)) : null;

  const Section = ({ title, children }: any) => (
    <View>
      <Text style={styles.sectionLbl}>{title}</Text>
      <View style={styles.block}>{children}</View>
    </View>
  );
  const KV = ({ k, v: val, mono }: any) => (
    <View style={styles.kvRow}>
      <Text style={styles.kvK}>{k}</Text>
      <Text style={[styles.kvV, mono && { fontFamily: 'monospace' }]}>{val ?? '—'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.title} numberOfLines={1}>{f.full_name || 'Farmer'}</Text>
          {f.nin_verified ? <Text style={{ fontSize: 18 }}>✅</Text> : null}
        </View>
        <Text style={styles.sub}>{[f.state, f.lga, f.ward].filter(Boolean).join(' · ') || 'No location'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>

        <Text style={styles.sectionLbl}>FARMER SCANS</Text>
        <View style={styles.scanGrid}>
          <View style={styles.scanTile}><Text style={styles.scanNum}>{counts.crop || 0}</Text><Text style={styles.scanLbl}>CROP</Text></View>
          <View style={styles.scanTile}><Text style={styles.scanNum}>{counts.pest || 0}</Text><Text style={styles.scanLbl}>PEST</Text></View>
          <View style={styles.scanTile}><Text style={styles.scanNum}>{counts.soil || 0}</Text><Text style={styles.scanLbl}>SOIL</Text></View>
          <View style={styles.scanTile}><Text style={styles.scanNum}>{counts.livestock || 0}</Text><Text style={styles.scanLbl}>LIVESTOCK</Text></View>
        </View>
        {scans.length === 0 ? <Text style={styles.empty}>No scans yet.</Text> : null}
        {scans.slice(0, 20).map((s: any, i: number) => (
          <View key={i} style={styles.scanRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanType}>{String(s.scan_type || 'scan').toUpperCase()}</Text>
              {s.subject ? <Text style={styles.scanSubject}>{s.subject}</Text> : null}
              {s.result_text ? <Text style={styles.scanResult} numberOfLines={2}>{s.result_text}</Text> : null}
              <Text style={styles.scanDate}>{new Date(s.created_at).toLocaleString()}</Text>
            </View>
            {s.image_url ? (
              <Pressable onPress={() => Linking.openURL(s.image_url)} style={styles.scanImg}>
                <Text style={styles.scanImgTxt}>📷</Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        {ndvi.latest ? (
          <Section title="NDVI">
            <KV k="Latest" v={Number(ndvi.latest).toFixed(3)} />
            <KV k="Health" v={String(ndvi.health || '—').toUpperCase()} />
          </Section>
        ) : null}

        <Section title="IDENTITY">
          <KV k="Farmer ID" v={f.unique_farmer_id} mono />
          <KV k="Name" v={f.full_name} />
          <KV k="Phone" v={f.phone} />
          <KV k="Age" v={age ? `${age} yrs` : '—'} />
          <KV k="Sex" v={f.sex} />
          <KV k="NIN" v={f.nin} mono />
          <KV k="NIN verified" v={f.nin_verified ? '✅ Yes' : '⏳ No'} />
          <KV k="KYC status" v={f.kyc_status} />
        </Section>

        <Section title="LOCATION">
          <KV k="State" v={f.state} />
          <KV k="LGA" v={f.lga} />
          <KV k="Ward" v={f.ward} />
          <KV k="GPS" v={f.gps_lat ? `${f.gps_lat}, ${f.gps_lon}` : '—'} mono />
          {f.gps_lat ? (
            <Pressable onPress={() => Linking.openURL(`https://maps.google.com/?q=${f.gps_lat},${f.gps_lon}`)} style={styles.actionBtn}>
              <Text style={styles.actionTxt}>OPEN IN MAPS</Text>
            </Pressable>
          ) : null}
        </Section>

        <Section title="FARM">
          <KV k="Crops" v={f.primary_crops} />
          <KV k="Size (acres)" v={f.farm_size_acres} />
          <KV k="Size (ha)" v={f.land_area_hectares} />
          <KV k="Land tenure" v={f.land_tenure} />
        </Section>

        <Section title="BANK">
          <KV k="Bank" v={f.bank_name} />
          <KV k="Account name" v={f.bank_account_name} />
          <KV k="Account #" v={f.bank_account_number} mono />
        </Section>

        {v.status ? (
          <Section title="VERIFICATION">
            <KV k="Status" v={v.status} />
            {v.id_image_url ? (
              <Pressable onPress={() => Linking.openURL(v.id_image_url)} style={styles.actionBtn}>
                <Text style={styles.actionTxt}>VIEW ID DOCUMENT</Text>
              </Pressable>
            ) : null}
            {v.selfie_url ? (
              <Pressable onPress={() => Linking.openURL(v.selfie_url)} style={styles.actionBtn}>
                <Text style={styles.actionTxt}>VIEW SELFIE</Text>
              </Pressable>
            ) : null}
          </Section>
        ) : null}

        {batches.length > 0 ? (
          <Section title={`BATCHES (${batches.length})`}>
            {batches.map((b: any, i: number) => (
              <View key={i} style={styles.scanRow}>
                <Text style={styles.scanSubject}>{b.batch_code} · {b.crop_name} · {b.quantity_kg}kg</Text>
              </View>
            ))}
          </Section>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian, padding: 20 },
  errorTxt: { color: '#ff3b5c', fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 20 },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: p.neon },
  backBtnTxt: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: p.text, flex: 1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  sectionLbl: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 20, marginBottom: 8 },
  block: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  kvRow: { flexDirection: 'row', paddingVertical: 6 },
  kvK: { fontSize: 12, color: '#888', width: 130 },
  kvV: { flex: 1, fontSize: 13, color: p.text, fontWeight: '600' },
  actionBtn: { marginTop: 10, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: p.neon, alignItems: 'center' },
  actionTxt: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  scanGrid: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  scanTile: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)', alignItems: 'center' },
  scanNum: { fontSize: 22, fontWeight: '900', color: p.neon },
  scanLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, marginTop: 2 },
  empty: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', textAlign: 'center', padding: 16 },
  scanRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  scanType: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  scanSubject: { fontSize: 12, color: p.text, marginTop: 2, fontWeight: '700' },
  scanResult: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  scanDate: { fontSize: 10, color: p.textDim, marginTop: 4 },
  scanImg: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(0,255,136,0.1)', alignItems: 'center', justifyContent: 'center' },
  scanImgTxt: { fontSize: 16 },
});
