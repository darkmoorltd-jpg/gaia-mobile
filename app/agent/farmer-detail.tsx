import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Image, Linking, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

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

  if (busy && !data) {
    return <View style={styles.center}><ActivityIndicator size="large" color={palette.neon} /></View>;
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTxt}>{error}</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backBtnTxt}>GO BACK</Text></Pressable>
      </View>
    );
  }
  if (!data) return <View style={styles.center}><Text style={styles.errorTxt}>Not found</Text></View>;

  const f = data.farmer || {};
  const v = data.verification || {};
  const scans = data.scans || [];
  const counts = data.scan_counts || {};
  const ndvi = data.ndvi || {};
  const batches = data.batches || [];
  const age = f.date_of_birth ? Math.floor((Date.now() - new Date(f.date_of_birth).getTime()) / (365.25 * 86400000)) : null;
  const isApproved = v.status === 'approved';
  const isPending = v.status === 'pending';
  const isRejected = v.status === 'rejected';

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
        <Text style={styles.sub}>
          {[f.state, f.lga, f.ward].filter(Boolean).join(' · ') || 'No location'}
        </Text>
        <View style={[styles.statusPill, {
          borderColor: isApproved ? palette.neon : isPending ? '#ffb300' : isRejected ? '#ff3b5c' : '#888',
        }]}>
          <Text style={[styles.statusTxt, {
            color: isApproved ? palette.neon : isPending ? '#ffb300' : isRejected ? '#ff3b5c' : '#888',
          }]}>
            {String(v.status || 'unverified').toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>

        {/* Scan summary — the new feature */}
        <Text style={styles.sectionLbl}>FARMER ACTIVITY (SCANS)</Text>
        <View style={styles.scanGrid}>
          <View style={styles.scanTile}><Text style={styles.scanNum}>{counts.crop || 0}</Text><Text style={styles.scanLbl}>CROP</Text></View>
          <View style={styles.scanTile}><Text style={styles.scanNum}>{counts.pest || 0}</Text><Text style={styles.scanLbl}>PEST</Text></View>
          <View style={styles.scanTile}><Text style={styles.scanNum}>{counts.soil || 0}</Text><Text style={styles.scanLbl}>SOIL</Text></View>
          <View style={styles.scanTile}><Text style={styles.scanNum}>{counts.livestock || 0}</Text><Text style={styles.scanLbl}>LIVESTOCK</Text></View>
        </View>
        {scans.length === 0 ? (
          <Text style={styles.empty}>No scans yet. Farmer will appear here after using the GAIA scan feature.</Text>
        ) : null}

        {scans.slice(0, 20).map((s: any, i: number) => (
          <View key={i} style={styles.scanRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanType}>{String(s.scan_type || 'scan').toUpperCase()}</Text>
              {s.subject ? <Text style={styles.scanSubject}>{s.subject}</Text> : null}
              {s.result_text ? <Text style={styles.scanResult} numberOfLines={2}>{s.result_text}</Text> : null}
              {s.confidence ? <Text style={styles.scanConf}>Confidence: {(s.confidence * 100).toFixed(0)}%</Text> : null}
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
          <Section title="SATELLITE / NDVI">
            <KV k="Latest NDVI" v={Number(ndvi.latest).toFixed(3)} />
            <KV k="Health" v={String(ndvi.health || '—').toUpperCase()} />
            <KV k="As of" v={ndvi.at ? new Date(ndvi.at).toLocaleDateString() : '—'} />
          </Section>
        ) : null}

        <Section title="IDENTITY">
          <KV k="Farmer ID" v={f.unique_farmer_id} mono />
          <KV k="Full name" v={f.full_name} />
          <KV k="Phone" v={f.phone} />
          <KV k="Date of birth" v={f.date_of_birth} />
          <KV k="Age" v={age ? `${age} years` : '—'} />
          <KV k="Sex" v={f.sex} />
          <KV k="NIN" v={f.nin} mono />
          <KV k="NIN verified" v={f.nin_verified ? '✅ Yes' : '⏳ No'} />
          <KV k="KYC status" v={f.kyc_status} />
        </Section>

        <Section title="LOCATION">
          <KV k="State" v={f.state} />
          <KV k="LGA" v={f.lga} />
          <KV k="Ward" v={f.ward} />
          <KV k="Community" v={f.community} />
          <KV k="GPS" v={f.gps_lat ? `${f.gps_lat}, ${f.gps_lon}` : '—'} mono />
          {f.gps_lat ? (
            <Pressable onPress={() => Linking.openURL(`https://maps.google.com/?q=${f.gps_lat},${f.gps_lon}`)} style={styles.actionBtn}>
              <Text style={styles.actionTxt}>OPEN IN MAPS</Text>
            </Pressable>
          ) : null}
        </Section>

        <Section title="FARM">
          <KV k="Primary crops" v={f.primary_crops} />
          <KV k="Category" v={f.farmer_category} />
          <KV k="Size (acres)" v={f.farm_size_acres} />
          <KV k="Size (hectares)" v={f.land_area_hectares} />
          <KV k="Scale" v={f.farm_size_scale} />
          <KV k="Land tenure" v={f.land_tenure} />
          <KV k="Title type" v={f.title_type} />
          <KV k="Farming since" v={f.farming_start_year} />
        </Section>

        <Section title="BANK">
          <KV k="Bank" v={f.bank_name} />
          <KV k="Account name" v={f.bank_account_name} />
          <KV k="Account #" v={f.bank_account_number} mono />
        </Section>

        {v.status ? (
          <Section title="VERIFICATION">
            <KV k="Status" v={v.status} />
            <KV k="ID type" v={v.id_type} />
            <KV k="Submitted" v={v.submitted_at ? new Date(v.submitted_at).toLocaleDateString() : '—'} />
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
            {v.rejection_reason ? (
              <View style={styles.rejectBox}>
                <Text style={styles.rejectLbl}>REJECTION REASON</Text>
                <Text style={styles.rejectTxt}>{v.rejection_reason}</Text>
              </View>
            ) : null}
          </Section>
        ) : null}

        {batches.length > 0 ? (
          <Section title={`HARVEST BATCHES (${batches.length})`}>
            {batches.map((b: any, i: number) => (
              <View key={i} style={styles.batchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.batchCode}>{b.batch_code}</Text>
                  <Text style={styles.batchMeta}>{b.crop_name} · {b.quantity_kg} kg</Text>
                </View>
                <Text style={styles.batchStatus}>{b.status}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {!isApproved && !isPending ? (
          <Pressable
            onPress={() => router.push(`/verify?farmerId=${id}` as any)}
            style={styles.cta}
          >
            <Text style={styles.ctaTxt}>{isRejected ? 'FIX & RESUBMIT' : 'START VERIFICATION'}</Text>
          </Pressable>
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
  statusPill: { alignSelf: 'flex-start', borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, marginTop: 8 },
  statusTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
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
  scanLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, marginTop: 2, letterSpacing: 0.5 },
  empty: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', textAlign: 'center', padding: 16 },
  scanRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  scanType: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  scanSubject: { fontSize: 12, color: p.text, marginTop: 2, fontWeight: '700' },
  scanResult: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  scanConf: { fontSize: 10, color: p.textDim, marginTop: 2 },
  scanDate: { fontSize: 10, color: p.textDim, marginTop: 4 },
  scanImg: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(0,255,136,0.1)', alignItems: 'center', justifyContent: 'center' },
  scanImgTxt: { fontSize: 16 },
  batchRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  batchCode: { fontSize: 12, fontWeight: '800', color: p.text, fontFamily: 'monospace' },
  batchMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  batchStatus: { fontSize: 10, fontWeight: '900', color: p.neon },
  rejectBox: { marginTop: 12, padding: 12, backgroundColor: 'rgba(255,59,92,0.08)', borderRadius: 8, borderWidth: 1, borderColor: '#ff3b5c' },
  rejectLbl: { fontSize: 9, fontWeight: '900', color: '#ff3b5c', letterSpacing: 1.5 },
  rejectTxt: { fontSize: 12, color: p.text, marginTop: 4 },
  cta: { marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
