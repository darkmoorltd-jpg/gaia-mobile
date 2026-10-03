import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminOps() {
  const router = useRouter();
  const { palette } = useTheme();
  const s = createStyles(palette);
  const user = useAuth((x) => x.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState<'withdrawals' | 'disputes' | 'kyc'>('withdrawals');
  const [wd, setWd] = useState<any[]>([]);
  const [disp, setDisp] = useState<any[]>([]);
  const [kyc, setKyc] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [act, setAct] = useState(false);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [a, b, c] = await Promise.all([
      supabase.rpc('admin_list_withdrawals', { p_status: 'pending' }),
      supabase.rpc('admin_list_disputes', { p_status: 'open' }),
      supabase.from('farmer_verifications').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    setWd(a.data || []);
    setDisp(b.data || []);
    setKyc(c.data || []);
    setBusy(false); setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const settle = (w: any, status: string) => {
    Alert.alert(status === 'paid' ? 'Mark as paid?' : 'Reject?', '₦' + Number(w.amount).toLocaleString() + ' for ' + w.email, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setAct(true);
        const { error } = await supabase.rpc('admin_settle_withdrawal', { p_id: w.id, p_status: status, p_note: null });
        setAct(false);
        if (error) Alert.alert('Failed', error.message); else load();
      }},
    ]);
  };

  const resolve = (d: any) => {
    Alert.alert('Resolve dispute', 'Mark as resolved with refund?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resolve', onPress: async () => {
        setAct(true);
        const { error } = await supabase.rpc('admin_resolve_dispute', {
          p_id: d.id, p_status: 'resolved', p_resolution: 'Refunded by admin',
        });
        setAct(false);
        if (error) Alert.alert('Failed', error.message); else load();
      }},
    ]);
  };

  const kycAction = async (v: any, status: string) => {
    setAct(true);
    await supabase.from('farmer_verifications').update({ status, rejection_reason: status === 'rejected' ? 'Rejected by admin' : null }).eq('id', v.id);
    await supabase.from('user_profiles').update({ verification_status: status }).eq('user_id', v.user_id);
    setAct(false);
    load();
  };

  if (!isAdmin) return <View style={s.blocked}><Text style={s.blockedText}>Access denied</Text></View>;

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>BACK</Text></Pressable>
        <Text style={s.title}>Ops Queue</Text>
        <Text style={s.sub}>{wd.length} withdrawals · {disp.length} disputes · {kyc.length} pending KYC</Text>

        <View style={s.tabBar}>
          <Pressable onPress={() => setTab('withdrawals')} style={[s.tabBtn, tab==='withdrawals' && s.tabBtnActive]}>
            <Text style={[s.tabText, tab==='withdrawals' && s.tabTextActive]}>Withdrawals</Text>
          </Pressable>
          <Pressable onPress={() => setTab('disputes')} style={[s.tabBtn, tab==='disputes' && s.tabBtnActive]}>
            <Text style={[s.tabText, tab==='disputes' && s.tabTextActive]}>Disputes</Text>
          </Pressable>
          <Pressable onPress={() => setTab('kyc')} style={[s.tabBtn, tab==='kyc' && s.tabBtnActive]}>
            <Text style={[s.tabText, tab==='kyc' && s.tabTextActive]}>KYC ({kyc.length})</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {tab === 'withdrawals' ? (
          wd.length === 0 ? <Text style={s.empty}>No pending withdrawals.</Text> :
          wd.map((w) => (
            <View key={w.id} style={s.card}>
              <Text style={s.cardTitle}>₦{Number(w.amount).toLocaleString()}</Text>
              <Text style={s.meta}>{w.email}</Text>
              <Text style={s.meta}>{new Date(w.requested_at).toLocaleString()}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable disabled={act} onPress={() => settle(w, 'paid')} style={[s.small, { borderColor: palette.neon }]}>
                  <Text style={[s.smallText, { color: palette.neon }]}>MARK PAID</Text>
                </Pressable>
                <Pressable disabled={act} onPress={() => settle(w, 'rejected')} style={[s.small, { borderColor: palette.danger }]}>
                  <Text style={[s.smallText, { color: palette.danger }]}>REJECT</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : null}

        {tab === 'disputes' ? (
          disp.length === 0 ? <Text style={s.empty}>No open disputes.</Text> :
          disp.map((d) => (
            <View key={d.id} style={s.card}>
              <Text style={s.cardTitle}>Order {(d.order_id || '').slice(0, 8)}…</Text>
              <Text style={s.meta}>Reason: {d.reason || '—'}</Text>
              <Text style={s.meta}>{new Date(d.created_at).toLocaleString()}</Text>
              <Pressable disabled={act} onPress={() => resolve(d)} style={[s.small, { borderColor: palette.neon, marginTop: 10 }]}>
                <Text style={[s.smallText, { color: palette.neon }]}>RESOLVE + REFUND</Text>
              </Pressable>
            </View>
          ))
        ) : null}

        {tab === 'kyc' ? (
          kyc.length === 0 ? <Text style={s.empty}>No pending KYC.</Text> :
          kyc.map((v) => (
            <View key={v.id} style={s.card}>
              <Text style={s.cardTitle}>{v.full_name || 'Unnamed'}</Text>
              <Text style={s.meta}>{v.phone} · {v.state}</Text>
              <Text style={s.meta}>Crops: {v.crops || '—'}</Text>
              <Text style={s.meta}>Submitted {new Date(v.created_at).toLocaleString()}</Text>

              {v.id_image_url ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={s.imgLabel}>ID</Text>
                  <Image source={{ uri: v.id_image_url }} style={s.img} resizeMode="contain" />
                  <Pressable onPress={() => Linking.openURL(v.id_image_url)}>
                    <Text style={s.link}>Open full</Text>
                  </Pressable>
                </View>
              ) : null}
              {v.selfie_url ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={s.imgLabel}>SELFIE</Text>
                  <Image source={{ uri: v.selfie_url }} style={s.img} resizeMode="contain" />
                  <Pressable onPress={() => Linking.openURL(v.selfie_url)}>
                    <Text style={s.link}>Open full</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable disabled={act} onPress={() => kycAction(v, 'approved')} style={[s.small, { borderColor: palette.neon }]}>
                  <Text style={[s.smallText, { color: palette.neon }]}>APPROVE</Text>
                </Pressable>
                <Pressable disabled={act} onPress={() => kycAction(v, 'rejected')} style={[s.small, { borderColor: palette.danger }]}>
                  <Text style={[s.smallText, { color: palette.danger }]}>REJECT</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 16, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  tabTextActive: { color: p.neon },
  card: { padding: 14, borderRadius: 12, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 15, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 40 },
  small: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  smallText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  img: { width: '100%', height: 180, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.15)' },
  imgLabel: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1, marginBottom: 6 },
  link: { fontSize: 11, fontWeight: '800', color: p.neon, marginTop: 6 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
