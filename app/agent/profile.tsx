import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Alert, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';

const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function AgentProfile() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const signOut = useAuth((s: any) => s.signOut);
  const user = useAuth((s: any) => s.user);

  const [stats, setStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [a, p] = await Promise.all([
        supabase.rpc('agent_dashboard'),
        supabase.from('user_profiles').select('*').eq('user_id', user?.id).maybeSingle(),
      ]);
      if (!a.error) setStats(a.data);
      if (!p.error) setProfile(p.data);
    } catch {}
    setBusy(false); setRef(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doSignOut = () => {
    Alert.alert('Sign out?', 'You will need to log in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        await signOut();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  const changePassword = async () => {
    if (pw.length < 6) { Alert.alert('Password', 'Min 6 characters'); return; }
    if (pw !== pw2) { Alert.alert('Mismatch', 'Passwords do not match'); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Done', 'Password updated');
    setPwOpen(false); setPw(''); setPw2('');
  };

  const s = stats || {};
  const p = profile || {};
  const name = s.agent_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || user?.email?.split('@')[0] || 'Agent';
  const initial = (name || 'A').charAt(0).toUpperCase();
  const status = (s.status || 'inactive').toLowerCase();
  const statusColor = status === 'active' ? palette.neon : (status === 'suspended' ? palette.danger : palette.warning);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <View style={styles.head}>
          <View style={[styles.avatar, { borderColor: statusColor }]}>
            <Text style={[styles.avatarTxt, { color: statusColor }]}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.sub} numberOfLines={1}>{user?.email}</Text>
            <View style={[styles.statusChip, { borderColor: statusColor }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <LinearGradient
          colors={['#00cc6a', '#009e52', '#00582e']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.earnCard}
        >
          <Text style={styles.earnLabel}>TOTAL EARNINGS</Text>
          <Text style={styles.earnVal}>{money(s.comm_total)}</Text>
          <View style={styles.earnRow}>
            <View style={styles.earnCol}>
              <Text style={styles.earnColVal}>{money(s.comm_pending)}</Text>
              <Text style={styles.earnColLbl}>PENDING</Text>
            </View>
            <View style={styles.earnDiv} />
            <View style={styles.earnCol}>
              <Text style={styles.earnColVal}>{money(s.comm_paid)}</Text>
              <Text style={styles.earnColLbl}>PAID</Text>
            </View>
            <View style={styles.earnDiv} />
            <View style={styles.earnCol}>
              <Text style={styles.earnColVal}>{money(s.comm_7d)}</Text>
              <Text style={styles.earnColLbl}>7 DAYS</Text>
            </View>
          </View>
        </LinearGradient>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <Text style={styles.section}>YOUR DETAILS</Text>
        <Row label="Agent code"  value={s.agent_code || p.agent_code || '—'} styles={styles} />
        <Row label="Zone"        value={s.agent_zone || p.agent_zone || '—'} styles={styles} />
        <Row label="Organization" value={s.agent_organization || '—'} styles={styles} />
        <Row label="Phone"       value={p.phone || '—'} styles={styles} />
        <Row label="WhatsApp"    value={p.whatsapp || '—'} styles={styles} />
        <Row label="State"       value={p.state || '—'} styles={styles} />
        <Row label="LGA"         value={p.lga || '—'} styles={styles} />
        <Row label="Member since" value={s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'} styles={styles} />

        <Text style={styles.section}>PAYOUT ACCOUNT</Text>
        <Row label="Bank"          value={p.bank_name || '—'} styles={styles} />
        <Row label="Account #"     value={p.account_number || '—'} styles={styles} />
        <Row label="Account name"  value={p.account_name || '—'} styles={styles} />
        {(p.bank_name || p.account_number) ? null : (
          <Text style={styles.hint}>
            Update your bank details in the farmer profile so commissions can be paid out.
          </Text>
        )}

        <Text style={styles.section}>STATS</Text>
        <Row label="Farmers registered" value={String(s.registered ?? 0)} styles={styles} />
        <Row label="Farmers verified"   value={String(s.verified ?? 0)} styles={styles} />
        <Row label="Rank" value={rankOf(s.registered, s.verified)} styles={styles} />

        <Text style={styles.section}>SETTINGS</Text>
        <Pressable onPress={() => setPwOpen(true)} style={styles.actionBtn}>
          <Text style={styles.actionTxt}>CHANGE PASSWORD</Text>
        </Pressable>
        <Pressable
          onPress={() => Alert.alert('Contact support', 'WhatsApp: +234 800 000 0000\nEmail: darkmoorltd@gmail.com')}
          style={styles.actionBtn}
        >
          <Text style={styles.actionTxt}>CONTACT SUPPORT</Text>
        </Pressable>
        <Pressable
          onPress={() => Alert.alert('Terms & Privacy', 'By using GAIA you agree to the terms shown at signup.')}
          style={styles.actionBtn}
        >
          <Text style={styles.actionTxt}>TERMS & PRIVACY</Text>
        </Pressable>

        <Pressable onPress={doSignOut} style={[styles.actionBtn, { borderColor: palette.danger }]}>
          <Text style={[styles.actionTxt, { color: palette.danger }]}>SIGN OUT</Text>
        </Pressable>

        <Text style={styles.version}>GAIA Agent · v1.0.0</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={pwOpen} animationType="slide" transparent onRequestClose={() => setPwOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalBg}>
            <View style={styles.modalSheet}>
              <Pressable onPress={() => setPwOpen(false)}>
                <Text style={styles.back}>CANCEL</Text>
              </Pressable>
              <Text style={styles.name}>Change Password</Text>
              <Text style={styles.sub}>Min 6 characters</Text>

              <Text style={styles.label}>NEW PASSWORD</Text>
              <TextInput value={pw} onChangeText={setPw} secureTextEntry style={styles.input} placeholderTextColor={palette.textDim} />

              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <TextInput value={pw2} onChangeText={setPw2} secureTextEntry style={styles.input} placeholderTextColor={palette.textDim} />

              <Pressable onPress={changePassword} disabled={pwBusy} style={[styles.cta, pwBusy && { opacity: 0.5 }]}>
                {pwBusy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>UPDATE PASSWORD</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function rankOf(reg: any, ver: any) {
  const r = Number(reg || 0);
  const v = Number(ver || 0);
  if (v >= 100) return 'Platinum';
  if (v >= 50) return 'Gold';
  if (v >= 20) return 'Silver';
  if (v >= 5) return 'Bronze';
  if (r > 0) return 'Rookie';
  return '—';
}

function Row({ label, value, styles }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowL}>{label}</Text>
      <Text style={styles.rowV} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,255,136,0.08)' },
  avatarTxt: { fontSize: 28, fontWeight: '900' },
  name: { fontSize: 22, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  statusChip: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  earnCard: { borderRadius: 20, padding: 20, marginBottom: 24 },
  earnLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: 'rgba(0,0,0,0.6)' },
  earnVal: { fontSize: 34, fontWeight: '900', color: '#000', letterSpacing: -1, marginTop: 4 },
  earnRow: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.15)' },
  earnCol: { flex: 1, alignItems: 'center' },
  earnColVal: { fontSize: 14, fontWeight: '900', color: '#000' },
  earnColLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: 'rgba(0,0,0,0.55)', marginTop: 3 },
  earnDiv: { width: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 22, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowL: { fontSize: 12, color: p.textMuted, flex: 1 },
  rowV: { fontSize: 13, color: p.text, flex: 1.5, textAlign: 'right', fontWeight: '600' },
  hint: { fontSize: 11, color: p.textMuted, fontStyle: 'italic', marginTop: 6, lineHeight: 16 },
  actionBtn: { padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center', marginTop: 10 },
  actionTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: p.neon },
  version: { fontSize: 10, color: p.textDim, textAlign: 'center', marginTop: 30, letterSpacing: 1 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginTop: 20 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
});
