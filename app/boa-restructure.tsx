import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const fmtN = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString() : '-';

export default function BoaRestructure() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('boa_restructure_queue', { p_zone: null });
    if (!r.error) setRows(r.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const act = (loanId: string, action: string) => {
    Alert.alert(
      action === 'extend' ? 'Extend 60 days?' : 'Flag for review?',
      'This will update the loan status.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => Alert.alert('Done', action === 'extend' ? 'Extended by 60 days' : 'Flagged') },
      ],
    );
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const total = rows.reduce((s, r) => s + Number(r.outstanding || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Restructure Queue</Text>
        <Text style={styles.sub}>Loans needing intervention · {rows.length} candidates · {fmtN(total)} total</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {rows.length === 0 && !busy ? (
          <View style={styles.empty}>
            <Text style={styles.kv}>No loans need restructuring right now.</Text>
          </View>
        ) : rows.map((r) => {
          const sevColor = r.severity === 'critical' ? '#ff3b5c' : r.severity === 'at_risk' ? '#ff6b35' : '#ffb300';
          const isOpen = expanded === r.loan_id;
          return (
            <View key={r.loan_id} style={[styles.card, { borderLeftColor: sevColor }]}>
              <Pressable onPress={() => setExpanded(isOpen ? null : r.loan_id)}>
                <View style={styles.cardHead}>
                  <Text style={[styles.cardKind, { color: sevColor }]}>
                    {String(r.severity).toUpperCase().replace('_', ' ')}
                  </Text>
                  <Text style={styles.cardRef}>{r.facility_ref}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>{r.email}</Text>
                <View style={styles.cardRow}>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardVal}>{fmtN(r.outstanding)}</Text>
                    <Text style={styles.cardMeta}>OUTSTANDING</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardVal}>Trust {r.trust_score}</Text>
                    <Text style={styles.cardMeta}>SCORE</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardVal}>{r.zone || '-'}</Text>
                    <Text style={styles.cardMeta}>ZONE</Text>
                  </View>
                </View>
              </Pressable>

              {isOpen ? (
                <View style={{ marginTop: 12 }}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailL}>Behavior</Text>
                    <Text style={styles.detailV}>{r.behavior}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailL}>Exposure</Text>
                    <Text style={styles.detailV}>{r.exposure_note}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailL}>Next payment</Text>
                    <Text style={styles.detailV}>{fmtN(r.next_payment_amount)} · {fmtDate(r.next_payment_date)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Pressable onPress={() => act(r.loan_id, 'extend')} style={[styles.actionBtn, { borderColor: palette.neon }]}>
                      <Text style={[styles.actionTxt, { color: palette.neon }]}>EXTEND 60 DAYS</Text>
                    </Pressable>
                    <Pressable onPress={() => act(r.loan_id, 'flag')} style={[styles.actionBtn, { borderColor: '#ff3b5c' }]}>
                      <Text style={[styles.actionTxt, { color: '#ff3b5c' }]}>FLAG FOR REVIEW</Text>
                    </Pressable>
                  </View>
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
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardKind: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  cardRef: { fontSize: 10, color: p.textMuted, fontWeight: '700' },
  cardTitle: { fontSize: 13, fontWeight: '800', color: p.text, marginBottom: 10 },
  cardRow: { flexDirection: 'row', gap: 10 },
  cardStat: { flex: 1 },
  cardVal: { fontSize: 13, fontWeight: '900', color: p.text },
  cardMeta: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  detailL: { fontSize: 11, color: p.textMuted },
  detailV: { fontSize: 12, fontWeight: '700', color: p.text },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  actionTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
