import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

function fmtN(n: any) { return 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 }); }

export default function Coop() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [pools, setPools] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [tonnes, setTonnes] = useState('1');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.rpc('coop_my_pools');
    setPools(data || []);
    setBusy(false);
    setRef(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const join = async () => {
    if (!selected) return;
    const t = parseFloat(tonnes);
    if (!isFinite(t) || t <= 0) { Alert.alert('Enter tonnes'); return; }
    setActing(true);
    const { error } = await supabase.rpc('coop_join', {
      p_pool_id: selected.id, p_tonnes: t,
    });
    setActing(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    await load();
    setSelected(null);
  };

  const leave = async () => {
    if (!selected) return;
    setActing(true);
    const { error } = await supabase.rpc('coop_leave', { p_pool_id: selected.id });
    setActing(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    await load();
    setSelected(null);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        <LinearGradient colors={['#0a1f14', '#0d3d20', '#0a1f14']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroKicker}>COOPERATIVE POOL</Text>
          <Text style={styles.heroTitle}>Sell as one</Text>
          <Text style={styles.heroSub}>
            Farmers in your state pool harvest into one lot. Bigger lot = higher price.
            GAIA negotiates with buyers as a single seller.
          </Text>
        </LinearGradient>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {pools.length === 0 && !busy ? (
          <View style={styles.empty}>
            <Text style={styles.kv}>No open pools in your state yet.</Text>
            <Text style={styles.kv} style={{ marginTop: 6, fontSize: 11 }}>
              Log activities in Season first, or ask an admin to open a pool.
            </Text>
          </View>
        ) : pools.map((p, i) => {
          const pct = p.target_tonnes > 0 ? Math.min(100, (Number(p.current_tonnes) / Number(p.target_tonnes)) * 100) : 0;
          const isMine = Number(p.my_tonnes) > 0;
          return (
            <Pressable key={i} onPress={() => { setSelected(p); setTonnes(String(p.my_tonnes || 1)); }} style={[styles.poolCard, isMine && styles.poolCardMine]}>
              <View style={styles.poolHead}>
                <Text style={styles.poolCrop}>{p.crop}</Text>
                <Text style={[styles.poolStatus, { color: p.status === 'open' ? '#00ff88' : '#ffb300' }]}>
                  {p.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.poolMeta}>{p.member_count} farmers · {Number(p.current_tonnes).toFixed(1)}t of {Number(p.target_tonnes).toFixed(0)}t target</Text>
              <View style={styles.poolBar}>
                <View style={[styles.poolFill, { width: pct + '%' }]} />
              </View>
              {p.best_offer_naira ? (
                <Text style={styles.bestOffer}>Best offer: {fmtN(p.best_offer_naira)}/t · {p.best_buyer}</Text>
              ) : null}
              {isMine ? <Text style={styles.mineBadge}>You: {Number(p.my_tonnes).toFixed(2)}t</Text> : null}
            </Pressable>
          );
        })}

        {selected ? (
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{selected.crop} pool · {selected.state}</Text>
            <Text style={styles.label}>YOUR TONNES</Text>
            <TextInput value={tonnes} onChangeText={setTonnes} keyboardType="decimal-pad"
              placeholder="1.0" placeholderTextColor={palette.textDim} style={styles.input} />
            <View style={styles.modalActions}>
              <Pressable onPress={join} disabled={acting} style={[styles.btn, { backgroundColor: '#00ff88' }]}>
                {acting ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxtDark}>JOIN POOL</Text>}
              </Pressable>
              {Number(selected.my_tonnes) > 0 ? (
                <Pressable onPress={leave} disabled={acting} style={[styles.btn, { borderWidth: 1.5, borderColor: '#ff3b5c' }]}>
                  <Text style={[styles.btnTxtDark, { color: '#ff3b5c' }]}>LEAVE</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => setSelected(null)} style={{ marginTop: 10, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted, fontSize: 12, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>HOW IT WORKS</Text>
          <Text style={styles.infoTxt}>1. Join a pool and enter your tonnes</Text>
          <Text style={styles.infoTxt}>2. When the pool hits target, GAIA finds buyers</Text>
          <Text style={styles.infoTxt}>3. Best offer wins; you get paid proportional to your tonnes</Text>
          <Text style={styles.infoTxt}>4. GAIA takes 2% to cover logistics + escrow</Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  hero: { padding: 24, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', marginBottom: 16 },
  heroKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#00ff88' },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -1, marginTop: 6 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 8, lineHeight: 18 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted, textAlign: 'center' },
  poolCard: { padding: 16, borderRadius: 16, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  poolCardMine: { borderColor: 'rgba(0,255,136,0.4)' },
  poolHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  poolCrop: { fontSize: 16, fontWeight: '900', color: p.text },
  poolStatus: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  poolMeta: { fontSize: 11, color: p.textMuted, marginBottom: 10 },
  poolBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  poolFill: { height: '100%', backgroundColor: '#00ff88', borderRadius: 3 },
  bestOffer: { fontSize: 11, color: '#00ff88', marginTop: 10, fontWeight: '700' },
  mineBadge: { fontSize: 11, color: '#ffb300', marginTop: 6, fontWeight: '800' },
  modal: { marginTop: 16, padding: 18, borderRadius: 16, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)' },
  modalTitle: { fontSize: 15, fontWeight: '900', color: p.text },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  btnTxtDark: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1.2 },
  infoBox: { marginTop: 20, padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: p.border },
  infoLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginBottom: 10 },
  infoTxt: { fontSize: 12, color: p.textMuted, lineHeight: 20 },
});
