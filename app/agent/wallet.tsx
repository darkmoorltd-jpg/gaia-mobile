import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 });

export default function AgentWallet() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [balance, setBalance] = useState<number>(0);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await supabase.rpc('agent_wallet_get');
      if (!r.error && r.data) setBalance(Number(r.data.balance || 0));
    } catch {}
    setBusy(false); setRef(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Agent Wallet</Text>
        <Text style={styles.sub}>Use this balance to pay for farmer verifications</Text>

        <View style={styles.balCard}>
          <Text style={styles.balLbl}>AVAILABLE BALANCE</Text>
          <Text style={styles.balVal}>{money(balance)}</Text>
        </View>

        <Text style={styles.sectionLabel}>TOP UP</Text>
        <Pressable onPress={() => Alert.alert('Coming soon', 'Direct wallet top-up via Paystack will be enabled in the next update. For now, contact admin to fund your wallet.')} style={styles.topupBtn}>
          <Text style={styles.topupTxt}>+ FUND WALLET</Text>
        </Pressable>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 24 },
  balCard: { padding: 24, borderRadius: 20, backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', alignItems: 'center' },
  balLbl: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#00ff88' },
  balVal: { fontSize: 40, fontWeight: '900', color: '#ffffff', letterSpacing: -1, marginTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.textMuted, marginTop: 32, marginBottom: 12 },
  topupBtn: { padding: 18, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.neon, alignItems: 'center' },
  topupTxt: { fontSize: 14, fontWeight: '900', color: p.neon, letterSpacing: 1 },
});
