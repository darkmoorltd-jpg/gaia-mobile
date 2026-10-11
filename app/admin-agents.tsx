import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Alert, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API = 'https://gaia-api-xuly.onrender.com';
const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

type Tab = 'agents' | 'applications';

export default function AdminAgents() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState<Tab>('agents');
  const [agents, setAgents] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [selectedApp, setSelectedApp] = useState<any>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [a, b] = await Promise.all([
      supabase.rpc('admin_agent_leaderboard'),
      supabase.rpc('admin_list_agent_applications', { p_status: 'pending' }),
    ]);
    if (!a.error) setAgents(a.data || []);
    if (!b.error) setApps(b.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);


  const approveApp = (ap: any) => {
    Alert.alert('Approve agent?', ap.full_name + ' (' + ap.email + ')', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        const r = await supabase.rpc('admin_approve_agent_application', { p_id: ap.id, p_code: null });
        if (r.error) { Alert.alert('Failed', r.error.message); return; }
        Alert.alert('Approved', 'Agent code: ' + ((r.data && r.data.agent_code) || '?'));
        load();
      }},
    ]);
  };

  const rejectApp = (ap: any) => {
    Alert.alert('Reject application?', ap.full_name + ' (' + ap.email + ')', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'REJECT', style: 'destructive', onPress: async () => {
        const r = await supabase.rpc('admin_reject_agent_application', {
          p_id: ap.id, p_reason: 'Rejected from admin panel',
        });
        if (r.error) { Alert.alert('Failed', r.error.message); return; }
        load();
      }},
    ]);
  };

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const totalPending = agents.reduce((s, a) => s + Number(a.comm_pending || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Agents</Text>
        <Text style={styles.sub}>{agents.length} active · {money(totalPending)} pending payout</Text>

        <View style={styles.tabBar}>
          <Pressable onPress={() => setTab('agents')} style={[styles.tabBtn, tab === 'agents' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'agents' && styles.tabTextOn]}>AGENTS ({agents.length})</Text>
          </Pressable>
          <Pressable onPress={() => setTab('applications')} style={[styles.tabBtn, tab === 'applications' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'applications' && styles.tabTextOn]}>APPLICATIONS ({apps.length})</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => setShowCreate(true)} style={styles.createBtn}>
          <Text style={styles.createBtnText}>+ REGISTER NEW AGENT</Text>
        </Pressable>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {tab === 'agents' ? agents.map((a, i) => (
          <Pressable key={i} onPress={() => setSelected(a)} style={styles.card}>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{(a.name || 'A').charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName} numberOfLines={1}>{a.name || a.email}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>{(a.agent_code || '-') + ' · ' + (a.agent_zone || 'no zone')}</Text>
              <View style={styles.cardStats}>
                <Text style={styles.statMini}>{a.registered} reg</Text>
                <Text style={styles.statMini}>{a.approved} verified</Text>
                <Text style={[styles.statMini, { color: a.comm_pending > 0 ? '#ffb300' : palette.textMuted }]}>{money(a.comm_pending)} pending</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )) : null}

        {tab === 'applications' ? (apps.length === 0 ? (
          <View style={styles.empty}><Text style={styles.kv}>No pending applications.</Text></View>
        ) : apps.map((ap, i) => (
          <Pressable key={i} onPress={() => setSelectedApp(ap)} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName} numberOfLines={1}>{ap.full_name}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>{ap.email} · {ap.phone}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>{ap.state || '?'} · {ap.zone || '?'} · {ap.experience_years} yrs</Text>
              {ap.motivation ? <Text style={styles.motiv} numberOfLines={2}>{ap.motivation}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <Text style={[styles.cardMeta, { color: ap.payment_status === 'paid' ? '#00ff88' : '#ffb300' }]}>
                  {(ap.payment_status || 'pending').toUpperCase()} N3,000
                </Text>
                {ap.whatsapp ? <Text style={styles.cardMeta}>WA: {ap.whatsapp}</Text> : null}
                {ap.home_address ? <Text style={styles.cardMeta} numberOfLines={1}>Addr: {ap.home_address}</Text> : null}
                {ap.bvn ? <Text style={styles.cardMeta}>BVN: {String(ap.bvn).slice(0,4)}***</Text> : null}
                {ap.nin ? <Text style={styles.cardMeta}>NIN: {String(ap.nin).slice(0,4)}***</Text> : null}
                {ap.bank_name ? <Text style={styles.cardMeta}>Bank: {ap.bank_name} {ap.bank_account_number ? '· ' + ap.bank_account_number : ''}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {ap.id_image_url ? <Image source={{ uri: ap.id_image_url }} style={{ width: 64, height: 64, borderRadius: 8 }} /> : null}
                {ap.selfie_url ? <Image source={{ uri: ap.selfie_url }} style={{ width: 64, height: 64, borderRadius: 8 }} /> : null}
                {ap.bank_statement_url ? (
                  <Pressable onPress={() => Linking.openURL(ap.bank_statement_url)} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: 'rgba(0,255,136,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#00ff88', fontSize: 10, fontWeight: '900' }}>STMT</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable onPress={() => approveApp(ap)} style={[styles.actionBtn, { flex: 1, marginTop: 0, borderColor: palette.neon }]}>
                  <Text style={styles.actionTxt}>APPROVE</Text>
                </Pressable>
                <Pressable onPress={() => rejectApp(ap)} style={[styles.actionBtn, { flex: 1, marginTop: 0, borderColor: '#ff3b5c' }]}>
                  <Text style={[styles.actionTxt, { color: '#ff3b5c' }]}>REJECT</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))) : null}

        <View style={{ height: 60 }} />
      </ScrollView>

      <CreateAgentModal visible={showCreate} onClose={() => { setShowCreate(false); load(); }} palette={palette} styles={styles} />

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title}>{selected?.name || 'Agent'}</Text>
            <Text style={styles.sub}>{selected?.email}</Text>
            <View style={styles.line}><Text style={styles.lineL}>Code</Text><Text style={styles.lineV}>{selected?.agent_code || '-'}</Text></View>
            <View style={styles.line}><Text style={styles.lineL}>Zone</Text><Text style={styles.lineV}>{selected?.agent_zone || '-'}</Text></View>
            <View style={styles.line}><Text style={styles.lineL}>Registered</Text><Text style={styles.lineV}>{selected?.registered || 0}</Text></View>
            <View style={styles.line}><Text style={styles.lineL}>Verified</Text><Text style={styles.lineV}>{selected?.approved || 0}</Text></View>
            <View style={styles.line}><Text style={styles.lineL}>Pending</Text><Text style={styles.lineV}>{money(selected?.comm_pending)}</Text></View>
            <View style={styles.line}><Text style={styles.lineL}>Paid</Text><Text style={styles.lineV}>{money(selected?.comm_paid)}</Text></View>

            <Pressable onPress={async () => {
              if (!selected) return;
              const ref2 = 'PAY_' + Date.now().toString(36).toUpperCase();
              const r = await supabase.rpc('admin_mark_commissions_paid', { p_agent_id: selected.agent_id, p_reference: ref2 });
              if (r.error) Alert.alert('Failed', r.error.message);
              else { Alert.alert('Paid', r.data + ' commissions marked paid'); setSelected(null); load(); }
            }} style={styles.actionBtn}>
              <Text style={styles.actionTxt}>MARK COMMISSIONS PAID</Text>
            </Pressable>

            <Pressable onPress={async () => {
              if (!selected) return;
              Alert.alert('Suspend agent?', 'They will be signed out and blocked.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'SUSPEND', style: 'destructive', onPress: async () => {
                  const r = await supabase.rpc('admin_suspend_agent', { p_user_id: selected.agent_id, p_reason: 'Suspended from admin panel' });
                  if (r.error) Alert.alert('Failed', r.error.message);
                  else { setSelected(null); load(); }
                }},
              ]);
            }} style={[styles.actionBtn, { borderColor: '#ff3b5c' }]}>
              <Text style={[styles.actionTxt, { color: '#ff3b5c' }]}>SUSPEND AGENT</Text>
            </Pressable>

            <Pressable onPress={async () => {
              if (!selected) return;
              const r = await supabase.rpc('admin_reactivate_agent', { p_user_id: selected.agent_id });
              if (r.error) Alert.alert('Failed', r.error.message);
              else { setSelected(null); load(); }
            }} style={styles.actionBtn}>
              <Text style={styles.actionTxt}>REACTIVATE</Text>
            </Pressable>

            <View style={{ height: 40 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CreateAgentModal({ visible, onClose, palette, styles }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [zone, setZone] = useState('');
  const [org, setOrg] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestedCode, setSuggestedCode] = useState('');

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const r = await supabase.rpc('admin_next_agent_code');
      if (!r.error && r.data) { setSuggestedCode(r.data); setAgentCode(r.data); }
    })();
  }, [visible]);

  const submit = async () => {
    if (!email || !password || !firstName || !lastName || !phone) {
      Alert.alert('Missing', 'All starred fields are required.'); return;
    }
    if (password.length < 6) { Alert.alert('Password', 'Min 6 characters'); return; }
    setBusy(true);
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      const r = await fetch(API + '/admin/create-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          email: email.trim(), password: password,
          first_name: firstName, last_name: lastName, phone: phone,
          agent_zone: zone || null, agent_organization: org || null,
          agent_code: agentCode || null, send_welcome_sms: true,
        }),
      });
      const data = await r.json();
      if (!r.ok) { Alert.alert('Failed', data.detail || data.error || r.status); setBusy(false); return; }
      Alert.alert('Agent created', 'Email: ' + data.email + '\nCode: ' + data.agent_code + '\nPassword: ' + data.password);
      setEmail(''); setPassword(''); setFirstName(''); setLastName(''); setPhone(''); setZone(''); setOrg('');
      onClose();
    } catch (e: any) { Alert.alert('Failed', e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Pressable onPress={onClose}><Text style={styles.back}>CANCEL</Text></Pressable>
              <Text style={styles.title}>New Agent</Text>
              <Text style={styles.sub}>Auto code: {suggestedCode || 'loading...'}</Text>

              <Text style={styles.label}>FIRST NAME *</Text>
              <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>LAST NAME *</Text>
              <TextInput value={lastName} onChangeText={setLastName} style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>PHONE *</Text>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>EMAIL *</Text>
              <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>PASSWORD *</Text>
              <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>AGENT CODE</Text>
              <TextInput value={agentCode} onChangeText={setAgentCode} autoCapitalize="characters" style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>ZONE</Text>
              <TextInput value={zone} onChangeText={setZone} style={styles.input} placeholder="e.g. Kaduna North" placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>ORGANIZATION</Text>
              <TextInput value={org} onChangeText={setOrg} style={styles.input} placeholder="e.g. BOA Kaduna" placeholderTextColor={palette.textDim} />

              <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
                {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>CREATE AGENT + SEND SMS</Text>}
              </Pressable>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 16, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabBtnOn: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 10, fontWeight: '900', color: p.textDim, letterSpacing: 1 },
  tabTextOn: { color: p.neon },
  createBtn: { padding: 14, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginBottom: 16 },
  createBtnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,255,136,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 18, fontWeight: '900', color: p.neon },
  cardName: { fontSize: 14, fontWeight: '800', color: p.text },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  cardStats: { flexDirection: 'row', gap: 10, marginTop: 6 },
  statMini: { fontSize: 10, fontWeight: '700', color: p.textMuted },
  chevron: { fontSize: 22, color: p.textDim },
  kv: { fontSize: 12, color: p.textMuted },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  motiv: { fontSize: 11, color: p.textDim, marginTop: 6, fontStyle: 'italic' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '92%' },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 20 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  lineL: { fontSize: 12, color: p.textMuted },
  lineV: { fontSize: 13, fontWeight: '800', color: p.text },
  actionBtn: { padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center', marginTop: 12 },
  actionTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: p.neon },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
