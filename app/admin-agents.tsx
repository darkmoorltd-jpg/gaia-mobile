import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Alert, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { useIsAdmin } from '../src/utils/admin';
import { supabase } from '../src/api/supabase';
import Dropdown from '../src/components/Dropdown';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

const API = 'https://gaia-api-xuly.onrender.com';
const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

type Tab = 'agents' | 'applications' | 'withdrawals';

export default function AdminAgents() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const { isAdmin, isSuperAdmin } = useIsAdmin();

  const [tab, setTab] = useState<Tab>('agents');
  const [agents, setAgents] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [wds, setWds] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [selectedApp, setSelectedApp] = useState<any>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [a, b, c] = await Promise.all([
      supabase.rpc('admin_agent_leaderboard'),
      supabase.rpc('admin_list_agent_applications', { p_status: 'pending' }),
      supabase.rpc('admin_list_agent_withdrawals', { p_status: 'pending' }),
    ]);
    if (!a.error) setAgents(a.data || []);
    if (!b.error) setApps(b.data || []);
    if (!c.error) setWds(c.data || []);
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
            <Text style={[styles.tabText, tab === 'applications' && styles.tabTextOn]}>APPS ({apps.length})</Text>
          </Pressable>
          <Pressable onPress={() => setTab('withdrawals')} style={[styles.tabBtn, tab === 'withdrawals' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'withdrawals' && styles.tabTextOn]}>PAYOUTS ({wds.length})</Text>
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
  const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
  const ID_TYPES = ['National ID Card', "Driver's License", 'International Passport', "Voter's Card (PVC)", 'NIN Slip'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [stateVal, setStateVal] = useState('Kaduna');
  const [lga, setLga] = useState('');
  const [city, setCity] = useState('');
  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');
  const [idType, setIdType] = useState('National ID Card');
  const [idNumber, setIdNumber] = useState('');
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [zone, setZone] = useState('');
  const [org, setOrg] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [notes, setNotes] = useState('');
  const [statePicker, setStatePicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestedCode, setSuggestedCode] = useState('');

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const r = await supabase.rpc('admin_next_agent_code');
      if (!r.error && r.data) { setSuggestedCode(r.data); setAgentCode(r.data); }
    })();
  }, [visible]);

  const pickImage = async (setter: (v: string) => void) => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!r.canceled) setter(r.assets[0].uri);
  };

  const uploadDoc = async (uri: string, folder: string): Promise<string | null> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      const path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error } = await supabase.storage.from('agent-docs').upload(path, bytes.buffer, { contentType: 'image/jpeg' });
      if (error) return null;
      const { data } = supabase.storage.from('agent-docs').getPublicUrl(path);
      return data.publicUrl;
    } catch { return null; }
  };

  const submit = async () => {
    if (!email || !firstName || !lastName || !phone) {
      Alert.alert('Missing', 'Email, first name, last name, and phone are required.'); return;
    }
    if (bvn && bvn.length !== 11) { Alert.alert('BVN', 'BVN must be 11 digits'); return; }
    if (nin && nin.length !== 11) { Alert.alert('NIN', 'NIN must be 11 digits'); return; }
    setBusy(true);
    try {
      let idUrl: string | null = null;
      let selfieUrl: string | null = null;
      if (idImage) idUrl = await uploadDoc(idImage, 'admin-ids');
      if (selfie) selfieUrl = await uploadDoc(selfie, 'admin-selfies');

      const r = await supabase.rpc('admin_create_agent', {
        p_email: email.trim(),
        p_password: password || '',
        p_first_name: firstName,
        p_middle_name: middleName || null,
        p_last_name: lastName,
        p_gender: gender || null,
        p_dob: dob || null,
        p_phone: phone,
        p_whatsapp: whatsapp || null,
        p_state: stateVal || null,
        p_lga: lga || null,
        p_city: city || null,
        p_street_address: streetAddress || null,
        p_bvn: bvn || null,
        p_nin: nin || null,
        p_id_type: idType || null,
        p_id_number: idNumber || null,
        p_id_image_url: idUrl,
        p_selfie_url: selfieUrl,
        p_bank_name: bankName || null,
        p_bank_account_number: accountNumber || null,
        p_bank_account_name: accountName || null,
        p_agent_zone: zone || null,
        p_agent_organization: org || null,
        p_agent_code: agentCode || null,
        p_admin_notes: notes || null,
      });
      if (r.error) { Alert.alert('Failed', r.error.message); setBusy(false); return; }
      const data = r.data || {};
      Alert.alert('Agent created', 'Code: ' + (data.agent_code || '?'));
      setEmail(''); setPassword(''); setFirstName(''); setMiddleName(''); setLastName('');
      setGender('Male'); setDob(''); setPhone(''); setWhatsapp('');
      setStreetAddress(''); setStateVal('Kaduna'); setLga(''); setCity('');
      setBvn(''); setNin(''); setIdType('National ID Card'); setIdNumber('');
      setIdImage(null); setSelfie(null);
      setBankName(''); setAccountNumber(''); setAccountName('');
      setZone(''); setOrg(''); setNotes('');
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
              <Text style={styles.sub}>Code: {suggestedCode || 'loading...'} · user must already have an account</Text>

              <Text style={styles.sectionHeader}>ACCOUNT</Text>
              <Text style={styles.label}>EMAIL *</Text>
              <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholderTextColor={palette.textDim} placeholder="existing user email" />
              <Text style={styles.label}>PASSWORD (unused — kept for API compat)</Text>
              <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholderTextColor={palette.textDim} />

              <Text style={styles.sectionHeader}>PERSONAL</Text>
              <Text style={styles.label}>FIRST NAME *</Text>
              <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>MIDDLE NAME</Text>
              <TextInput value={middleName} onChangeText={setMiddleName} style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>LAST NAME *</Text>
              <TextInput value={lastName} onChangeText={setLastName} style={styles.input} placeholderTextColor={palette.textDim} />
              <Dropdown
                label="GENDER"
                value={gender}
                options={['Male', 'Female', 'Other']}
                onChange={setGender}
              />
              <Text style={styles.label}>DATE OF BIRTH (YYYY-MM-DD)</Text>
              <TextInput value={dob} onChangeText={setDob} placeholder="1990-01-15" placeholderTextColor={palette.textDim} style={styles.input} />
              <Text style={styles.label}>PHONE *</Text>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>WHATSAPP</Text>
              <TextInput value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" style={styles.input} placeholderTextColor={palette.textDim} />

              <Text style={styles.sectionHeader}>ADDRESS</Text>
              <Text style={styles.label}>STREET ADDRESS</Text>
              <TextInput value={streetAddress} onChangeText={setStreetAddress} multiline style={[styles.input, { minHeight: 60 }]} placeholderTextColor={palette.textDim} />
              <Dropdown
                label="STATE"
                value={stateVal}
                options={NIGERIAN_STATES}
                onChange={setStateVal}
              />
              <Text style={styles.label}>LGA</Text>
              <TextInput value={lga} onChangeText={setLga} style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>CITY</Text>
              <TextInput value={city} onChangeText={setCity} style={styles.input} placeholderTextColor={palette.textDim} />

              <Text style={styles.sectionHeader}>KYC</Text>
              <Text style={styles.label}>BVN (11 DIGITS)</Text>
              <TextInput value={bvn} onChangeText={setBvn} keyboardType="number-pad" maxLength={11} style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>NIN (11 DIGITS)</Text>
              <TextInput value={nin} onChangeText={setNin} keyboardType="number-pad" maxLength={11} style={styles.input} placeholderTextColor={palette.textDim} />
              <Dropdown
                label="ID TYPE"
                value={idType}
                options={ID_TYPES}
                onChange={setIdType}
              />
              <Text style={styles.label}>ID NUMBER</Text>
              <TextInput value={idNumber} onChangeText={setIdNumber} style={styles.input} placeholderTextColor={palette.textDim} />

              <Text style={styles.label}>ID IMAGE</Text>
              <Pressable onPress={() => pickImage(setIdImage)} style={styles.uploadBtn}>
                <Text style={styles.uploadText}>{idImage ? 'Change ID image' : 'Upload ID image'}</Text>
              </Pressable>
              {idImage ? <Image source={{ uri: idImage }} style={{ width: 100, height: 100, borderRadius: 10, marginTop: 8 }} /> : null}

              <Text style={styles.label}>SELFIE WITH ID</Text>
              <Pressable onPress={() => pickImage(setSelfie)} style={styles.uploadBtn}>
                <Text style={styles.uploadText}>{selfie ? 'Change selfie' : 'Upload selfie'}</Text>
              </Pressable>
              {selfie ? <Image source={{ uri: selfie }} style={{ width: 100, height: 100, borderRadius: 10, marginTop: 8 }} /> : null}

              <Text style={styles.sectionHeader}>BANK</Text>
              <Text style={styles.label}>BANK NAME</Text>
              <TextInput value={bankName} onChangeText={setBankName} style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>ACCOUNT NUMBER</Text>
              <TextInput value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" maxLength={10} style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>ACCOUNT NAME</Text>
              <TextInput value={accountName} onChangeText={setAccountName} style={styles.input} placeholderTextColor={palette.textDim} />

              <Text style={styles.sectionHeader}>AGENT</Text>
              <Text style={styles.label}>AGENT CODE</Text>
              <TextInput value={agentCode} onChangeText={setAgentCode} autoCapitalize="characters" style={styles.input} placeholderTextColor={palette.textDim} />
              <Text style={styles.label}>ZONE</Text>
              <TextInput value={zone} onChangeText={setZone} placeholder="e.g. Kaduna North" placeholderTextColor={palette.textDim} style={styles.input} />
              <Text style={styles.label}>ORGANIZATION</Text>
              <TextInput value={org} onChangeText={setOrg} placeholder="e.g. BOA Kaduna" placeholderTextColor={palette.textDim} style={styles.input} />

              <Text style={styles.label}>ADMIN NOTES (internal)</Text>
              <TextInput value={notes} onChangeText={setNotes} multiline style={[styles.input, { minHeight: 80 }]} placeholderTextColor={palette.textDim} />

              <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
                {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>CREATE AGENT</Text>}
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