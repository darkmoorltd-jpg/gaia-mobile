import React, {                useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Image, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const fmtN = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const fmtM = (n: any) => {
  const x = Number(n || 0);
  if (x >= 1e6) return 'N' + (x / 1e6).toFixed(2) + 'M';
  if (x >= 1e3) return 'N' + (x / 1e3).toFixed(0) + 'K';
  return 'N' + x.toFixed(0);
};
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString() : '-';

export default function BoaBorrower() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin || !params.id) return;
    setBusy(true);
    const r = await supabase.rpc('boa_borrower_detail', { p_user_id: params.id });
    if (!r.error) setD(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin, params.id]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  if (busy && !d) return <View style={styles.blocked}><ActivityIndicator color={palette.neon} /></View>;
  if (!d) return <View style={styles.blocked}><Text style={styles.blockedText}>Borrower not found</Text></View>;

  const p = d.profile || {};
  const trust = Number(d.totals?.trust_score ?? 50);
  const color = trust >= 80 ? '#00ff88' : trust >= 60 ? '#ffb300' : trust >= 40 ? '#ff6b35' : '#ff3b5c';
  const scan = d.scan_stats || {};

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        <View style={styles.head}>
          <View style={[styles.avatar, { borderColor: color }]}>
            <Text style={[styles.avatarTxt, { color }]}>
              {((p.first_name || d.user?.email || 'U').charAt(0)).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {((p.first_name || '') + ' ' + (p.last_name || '')).trim() || d.user?.email}
            </Text>
            <Text style={styles.email} numberOfLines={1}>{d.user?.email}</Text>
            <Text style={[styles.trust, { color }]}>Trust {trust}  ·  {p.state || '-'}</Text>
          </View>
        </View>

        <Section styles={styles} title="LOAN BOOK">
          <Row styles={styles} label="Facility total" value={fmtN(d.totals?.facility)} />
          <Row styles={styles} label="Outstanding" value={fmtN(d.totals?.outstanding)} accent={palette.warning} />
          <Row styles={styles} label="Active loans" value={String(d.totals?.active_loans ?? 0)} />
          {(d.loans || []).slice(0, 5).map((l: any, i: number) => (
            <View key={i} style={styles.loanCard}>
              <Text style={styles.loanRef}>{l.facility_ref}</Text>
              <Text style={styles.loanMeta}>
                {fmtN(l.facility_amount)}  ·  outstanding {fmtN(l.outstanding)}  ·  {l.status}
              </Text>
              <Text style={styles.loanMeta}>
                Disbursed {fmtDate(l.disbursed_at)}  ·  Next {fmtDate(l.next_payment_date)}
              </Text>
            </View>
          ))}
        </Section>

        <Section styles={styles} title="FARM REALITY">
          <Row styles={styles} label="Farms mapped" value={String((d.farms || []).length)} />
          <Row styles={styles} label="Total hectares" value={String(
            (d.farms || []).reduce((s: number, f: any) => s + Number(f.hectares || 0), 0).toFixed(2)
          )} />
          {(d.farms || []).slice(0, 3).map((f: any, i: number) => (
            <View key={i} style={styles.loanCard}>
              <Text style={styles.loanRef}>{f.name}</Text>
              <Text style={styles.loanMeta}>
                {f.crop || 'crop n/a'}  ·  {Number(f.hectares || 0).toFixed(2)} ha  ·  {f.state || '-'}
              </Text>
            </View>
          ))}
        </Section>

        <Section styles={styles} title="BEHAVIOR PULSE">
          <Row styles={styles} label="Total scans" value={String(scan.total ?? 0)} />
          <Row styles={styles} label="Scans last 30d" value={String(scan.last_30d ?? 0)} />
          <Row styles={styles} label="Disease hits 30d" value={String(scan.disease_hits_30d ?? 0)} accent={palette.danger} />
          <Row styles={styles} label="Last scan" value={fmtDate(scan.last_scan_at)} />
          <Row styles={styles} label="Last seen app" value={d.presence?.last_seen ? new Date(d.presence.last_seen).toLocaleString() : 'never'} />
        </Section>

        <Section styles={styles} title="RECENT SCANS">
          {(d.recent_scans || []).length === 0 ? (
            <Text style={styles.kv}>No scans yet.</Text>
          ) : (d.recent_scans || []).slice(0, 5).map((s: any, i: number) => (
            <View key={i} style={styles.scanRow}>
              {s.image_url ? (
                <Image source={{ uri: s.image_url }} style={styles.scanImg} />
              ) : (
 <View style={[styles.scanImg, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={styles.kv}>no img</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.scanLabel} numberOfLines={1}>{s.top_label}</Text>
                <Text style={styles.scanMeta}>{Number(s.confidence || 0).toFixed(1)}%  ·  {s.crop || '-'}</Text>
                <Text style={styles.scanMeta}>{fmtDate(s.created_at)}</Text>
              </View>
            </View>
          ))}
        </Section>

        <Section styles={styles} title="ACTIONS">
          <View style={styles.actionRow}>
            {d.profile?.phone ? (
              <Pressable onPress={() => Linking.openURL('tel:' + d.profile.phone)} style={[styles.actionBtn, { borderColor: palette.neon }]}>
                <Text style={[styles.actionTxt, { color: palette.neon }]}>CALL</Text>
              </Pressable>
            ) : null}
            {d.profile?.phone ? (
              <Pressable onPress={() => Linking.openURL('https://wa.me/' + String(d.profile.phone).replace(/\D/g, ''))} style={[styles.actionBtn, { borderColor: '#25d366' }]}>
                <Text style={[styles.actionTxt, { color: '#25d366' }]}>WHATSAPP</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.push(('/boa-map?id=' + params.id) as any)} style={[styles.actionBtn, { borderColor: palette.border }]}>
              <Text style={[styles.actionTxt, { color: palette.text }]}>MAP</Text>
            </Pressable>
          </View>
        </Section>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function Section({ title, children, styles }: any) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, accent, styles }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowL}>{label}</Text>
      <Text style={[styles.rowV, accent && { color: accent }]}>{value}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  avatar: { width: 56, height: :56, borderRadius: 28 ', borderWidth: 2.5, alignItemscenter: 'center', justifyContent' },
  avatarTxt: { fontSize: 22, fontWeight: '900' },
  name: { fontSize: 20, fontWeight: '900', color: p.text, letterSpacing: -0.4 },
  email: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  trust: { fontSize: 11, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowL: { fontSize: 12, color: p.textMuted, flex: 1 },
  rowV: { fontSize: 13, fontWeight: '800', color: p.text },
  kv: { fontSize: 12, color: p.textMuted },
  loanCard: { padding: 10, borderRadius: 10, backgroundColor: p.surface, marginTop: 8, borderWidth: 1, borderColor: p.border },
  loanRef: { fontSize: 12, fontWeight: '900', color: p.text },
  loanMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  scanImg: { width: 48, height: 48, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.2)' },
  scanLabel: { fontSize: 12, fontWeight: '800', color: p.text },
  scanMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  actionTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 18, fontWeight: '900', color: p.danger },
});
