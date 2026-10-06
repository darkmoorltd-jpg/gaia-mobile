import { useState } from 'react';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const API = 'https://gaia-api-xuly.onrender.com';

interface Row {
  user_id: string;
  email: string;
  full_name: string;
  has_wallet: boolean;
  account_number: string | null;
}

export default function AdminProvisionWallets() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const v = await supabase
        .from('farmer_verifications')
        .select('user_id, full_name, status')
        .eq('status', 'approved');
      const verif = v.data || [];

      const wallets = await supabase
        .from('farmer_wallets')
        .select('user_id, account_number');
      const wmap: Record<string, string | null> = {};
      (wallets.data || []).forEach((w: any) => { wmap[w.user_id] = w.account_number; });

      const profiles = await supabase
        .from('user_profiles')
        .select('user_id, email, first_name, last_name');
      const pmap: Record<string, any> = {};
      (profiles.data || []).forEach((p: any) => { pmap[p.user_id] = p; });

      const out: Row[] = [];
      for (const vv of verif) {
        const p = pmap[vv.user_id] || {};
        const acct = wmap[vv.user_id] || null;
        out.push({
          user_id: vv.user_id,
          email: p.email || '',
          full_name: vv.full_name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || p.email || 'User',
          has_wallet: !!acct,
          account_number: acct,
        });
      }
      // Pending first
      out.sort((a, b) => Number(a.has_wallet) - Number(b.has_wallet));
      setRows(out);
    } catch (e) { console.log(e); }
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const provisionOne = async (row: Row) => {
    setWorking(row.user_id);
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      const r = await fetch(API + '/wallet/provision-by-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ user_id: row.user_id }),
      });
      const d = await r.json();
      if (r.ok) {
        Alert.alert('Success', (d.already_provisioned ? 'Already had: ' : 'Assigned: ') + (d.account_number || ''));
        await load();
      } else {
        Alert.alert('Failed', d.detail || d.error || 'Try again');
      }
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Network error');
    }
    setWorking(null);
  };

  const provisionAll = async () => {
    const pending = rows.filter((r) => !r.has_wallet);
    if (pending.length === 0) { Alert.alert('All users already have accounts'); return; }
    Alert.alert('Provision ' + pending.length + ' wallets?', 'This will create NUBANs for every approved user without one.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'PROVISION', onPress: async () => {
        setBatchBusy(true);
        const s = await supabase.auth.getSession();
        const token = s.data.session?.access_token;
        let ok = 0;
        let fail = 0;
        const errs: string[] = [];
        for (const row of pending) {
          try {
            const r = await fetch(API + '/wallet/provision-by-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
              body: JSON.stringify({ user_id: row.user_id }),
            });
            const d = await r.json();
            if (r.ok) ok++;
            else { fail++; errs.push((row.email || row.user_id.slice(0,6)) + ': ' + (d.detail || d.error || '?')); }
          } catch (e: any) {
            fail++; errs.push((row.email || '?') + ': ' + (e?.message || 'network'));
          }
        }
        setBatchBusy(false);
        await load();
        Alert.alert('Done', 'Provisioned: ' + ok + '\nFailed: ' + fail + (errs.length ? '\n\n' + errs.slice(0, 5).join('\n') : ''));
      }},
    ]);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const pendingCount = rows.filter((r) => !r.has_wallet).length;
  const provisionedCount = rows.length - pendingCount;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Provision Wallets</Text>
        <Text style={styles.sub}>Assign Nigerian account numbers to verified farmers</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: '#00ff88' }]}>{provisionedCount}</Text>
            <Text style={styles.statLbl}>PROVISIONED</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: '#ffb300' }]}>{pendingCount}</Text>
            <Text style={styles.statLbl}>PENDING</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{rows.length}</Text>
            <Text style={styles.statLbl}>TOTAL</Text>
          </View>
        </View>

        {pendingCount > 0 ? (
          <Pressable onPress={provisionAll} disabled={batchBusy} style={[styles.batchBtn, batchBusy && { opacity: 0.5 }]}>
            {batchBusy ? <ActivityIndicator color="#000" /> : (
              <Text style={styles.batchBtnTxt}>PROVISION ALL {pendingCount}</Text>
            )}
          </Pressable>
        ) : null}

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {rows.map((r) => (
          <View key={r.user_id} style={styles.card}>
            <View style={styles.cardLeft}>
              <View style={[styles.dot, { backgroundColor: r.has_wallet ? '#00ff88' : '#ffb300' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>{r.full_name}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>{r.email}</Text>
                {r.has_wallet ? (
                  <Text style={styles.cardAcct}>{r.account_number}</Text>
                ) : (
                  <Text style={[styles.cardAcct, { color: '#ffb300' }]}>No wallet yet</Text>
                )}
              </View>
            </View>
            {!r.has_wallet ? (
              <Pressable onPress={() => provisionOne(r)} disabled={working === r.user_id} style={styles.provBtn}>
                {working === r.user_id ? <ActivityIndicator color="#000" size="small" /> : (
                  <Text style={styles.provBtnTxt}>PROVISION</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        ))}

        {rows.length === 0 && !busy ? (
          <View style={styles.empty}><Text style={styles.kv}>No approved verifications yet.</Text></View>
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
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900', color: p.text },
  statLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1.2, marginTop: 4 },
  batchBtn: { padding: 18, borderRadius: 14, backgroundColor: '#ffb300', alignItems: 'center', marginBottom: 16 },
  batchBtnTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardName: { fontSize: 14, fontWeight: '800', color: p.text },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  cardAcct: { fontSize: 12, fontWeight: '900', color: '#00ff88', marginTop: 4, letterSpacing: 1 },
  provBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#ffb300', alignItems: 'center', justifyContent: 'center', minWidth: 92 },
  provBtnTxt: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1.2 },
  empty: { padding: 30, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
