import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const fmtN = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function BoaFieldOfficers() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email === 'darkmoorltd@gmail.com';

  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('boa_field_officer_roster', { p_zone: null });
    if (!r.error) setRows(r.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const totalVisits = rows.reduce((s, r) => s + Number(r.visits_30d || 0), 0);
  const totalVerified = rows.reduce((s, r) => s + Number(r.verified_30d || 0), 0);
  const totalCash = rows.reduce((s, r) => s + Number(r.cash_30d || 0), 0);
  const verifiedPct = totalVisits > 0 ? Math.round((totalVerified / totalVisits) * 100) : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Field Officers</Text>
        <Text style={styles.sub}>{rows.length} active · tap to view activity</Text>

        {rows.length > 0 ? (
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryVal}>{totalVisits}</Text>
              <Text style={styles.summaryLbl}>VISITS 30D</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={[styles.summaryVal, { color: verifiedPct >= 80 ? '#00ff88' : verifiedPct >= 50 ? '#ffb300' : '#ff3b5c' }]}>
                {verifiedPct}%
              </Text>
              <Text style={styles.summaryLbl}>VERIFIED</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryVal}>{fmtN(totalCash)}</Text>
              <Text style={styles.summaryLbl}>CASH 30D</Text>
            </View>
          </View>
        ) : null}

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {rows.length === 0 && !busy ? (
          <View style={styles.empty}>
            <Text style={styles.kv}>No field officers registered yet.</Text>
            <Text style={[styles.kv, { marginTop: 6, fontSize: 11 }]}>
              Add rows to boa_field_officers table to see the roster here.
            </Text>
          </View>
        ) : rows.map((o, i) => {
          const v30 = Number(o.visits_30d || 0);
          const ver30 = Number(o.verified_30d || 0);
          const pct = v30 > 0 ? Math.round((ver30 / v30) * 100) : 0;
          const col = v30 === 0 ? '#8899a6' : pct >= 80 ? '#00ff88' : pct >= 50 ? '#ffb300' : '#ff3b5c';

          return (
            <Pressable
              key={i}
              onPress={() => router.push(('/boa-officer-detail?id=' + o.user_id) as any)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.cardHead}>
                <View style={[styles.avatar, { borderColor: col }]}>
                  <Text style={[styles.avatarTxt, { color: col }]}>
                    {(o.full_name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName} numberOfLines={1}>{o.full_name}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>{o.zone || '-'} · {o.phone || '-'}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{v30}</Text>
                  <Text style={styles.statLbl}>VISITS</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statVal, { color: col }]}>{pct}%</Text>
                  <Text style={styles.statLbl}>VERIFIED</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{fmtN(o.cash_30d)}</Text>
                  <Text style={styles.statLbl}>CASH</Text>
                </View>
              </View>

              {v30 > 0 && pct < 80 ? (
                <View style={styles.flag}>
                  <Text style={styles.flagText}>
                    FLAG: {v30 - ver30} visit{v30 - ver30 !== 1 ? 's' : ''} not GPS-verified
                  </Text>
                </View>
              ) : null}

              {o.phone ? (
                <View style={styles.actions}>
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); Linking.openURL('tel:' + o.phone); }}
                    style={[styles.actionBtn, { borderColor: '#00ff88' }]}
                  >
                    <Text style={[styles.actionTxt, { color: '#00ff88' }]}>CALL</Text>
                  </Pressable>
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); Linking.openURL('https://wa.me/' + String(o.phone).replace(/[^0-9]/g, '')); }}
                    style={[styles.actionBtn, { borderColor: '#25d366' }]}
                  >
                    <Text style={[styles.actionTxt, { color: '#25d366' }]}>WHATSAPP</Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
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
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  summaryBox: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  summaryVal: { fontSize: 18, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  summaryLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted, textAlign: 'center' },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 18, fontWeight: '900' },
  cardName: { fontSize: 15, fontWeight: '800', color: p.text },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: p.textDim },
  statsRow: { flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 14, fontWeight: '900', color: p.text },
  statLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  flag: { marginTop: 10, padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,59,92,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.3)' },
  flagText: { fontSize: 10, fontWeight: '800', color: '#ff3b5c', letterSpacing: 0.5, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  actionTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
