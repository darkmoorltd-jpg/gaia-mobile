import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Modal, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

const LEVELS = [
  { id: 'national', label: 'NATIONAL', desc: 'Sees ALL Nigeria data — all farmers, all polygons, all NDVI' },
  { id: 'state', label: 'STATE', desc: 'Restricted to one state only' },
  { id: 'ifad', label: 'IFAD', desc: 'Full national access (donor)' },
];

type Mode = 'create' | 'grant';

export default function AdminMinistryUsers() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const styles = createStyles(palette);

  const [users, setUsers] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<Mode>('create');

  // Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [level, setLevel] = useState('national');
  const [scopeState, setScopeState] = useState('Lagos');
  const [organization, setOrganization] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_list_ministry_users');
    if (error) {
      Alert.alert('Load failed', error.message);
    } else {
      setUsers(Array.isArray(data) ? data : []);
    }
    setBusy(false);
  }, [isAdmin]);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submitCreate = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing', 'Email and password required');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password', 'Min 6 characters');
      return;
    }
    if (level === 'state' && !scopeState) {
      Alert.alert('State required', 'Pick a state for state-level user');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-ministry-user', {
        body: {
          email: email.trim().toLowerCase(),
          password: password.trim(),
          level,
          scope_state: level === 'state' ? scopeState : null,
          organization: organization.trim() || null,
          full_name: fullName.trim() || null,
        },
      });

      // CRITICAL: read the actual error from data (functions.invoke hides it in `error`)
      if (error) {
        // Try to extract body from error context
        let detailedError = error.message || 'Function failed';
        try {
          const contextBody = (error as any).context?.body;
          const parsed = typeof contextBody === 'string' ? JSON.parse(contextBody) : contextBody;
          if (parsed?.error) detailedError = parsed.error;
        } catch {}
        if (data?.error) detailedError = data.error;
        throw new Error(detailedError);
      }
      if (!data?.ok) throw new Error(data?.error || 'Creation failed');

      Alert.alert(
        data.note?.includes('Existing') ? 'Access Granted ✅' : 'User Created ✅',
        `Email: ${email.trim()}\nPassword: ${password.trim()}\n\nGive these to the ministry user. They can log in to gaia-ministry immediately.`,
        [{ text: 'OK', onPress: () => {
          setShowModal(false);
          setEmail(''); setPassword(''); setFullName(''); setOrganization('');
          load();
        }}]
      );
    } catch (e: any) {
      Alert.alert('Create failed', e.message || 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitGrant = async () => {
    if (!email.trim()) {
      Alert.alert('Missing', 'Email required');
      return;
    }
    if (level === 'state' && !scopeState) {
      Alert.alert('State required', 'Pick a state');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('admin_grant_ministry_by_email', {
        p_email: email.trim().toLowerCase(),
        p_level: level,
        p_scope_state: level === 'state' ? scopeState : null,
        p_organization: organization.trim() || null,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Grant failed');

      Alert.alert(
        'Access Granted ✅',
        `${email.trim()} can now log in to gaia-ministry with their existing password.`,
        [{ text: 'OK', onPress: () => {
          setShowModal(false);
          setEmail(''); setFullName(''); setOrganization('');
          load();
        }}]
      );
    } catch (e: any) {
      Alert.alert('Grant failed', e.message || 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = (u: any) => {
    Alert.alert('Revoke access?', u.email, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'REVOKE', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.rpc('admin_revoke_ministry_user', { p_user_id: u.user_id });
          if (error) throw error;
          await load();
          Alert.alert('Revoked');
        } catch (e: any) {
          Alert.alert('Failed', e.message);
        }
      }},
    ]);
  };

  if (!isAdmin) {
    return <View style={styles.blocked}><Text style={styles.blockedTxt}>Access denied</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Ministry Users</Text>
        <Text style={styles.sub}>{users.length} active</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>

        <Pressable onPress={() => { setMode('create'); setShowModal(true); }} style={styles.cta}>
          <Text style={styles.ctaTxt}>+ CREATE MINISTRY USER</Text>
        </Pressable>

        {busy && users.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}
        {!busy && users.length === 0 ? (
          <Text style={styles.empty}>No ministry users yet. Create one above.</Text>
        ) : null}

        {users.map(u => (
          <View key={u.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={styles.cardEmail} numberOfLines={1}>{u.email}</Text>
              <View style={styles.levelBadge}><Text style={styles.levelTxt}>{u.level.toUpperCase()}</Text></View>
            </View>
            {u.scope_state ? <Text style={styles.cardMeta}>📍 {u.scope_state}</Text> : <Text style={styles.cardMeta}>📍 All Nigeria</Text>}
            {u.organization ? <Text style={styles.cardMeta}>🏛️ {u.organization}</Text> : null}
            <Text style={styles.cardMeta}>Created {new Date(u.granted_at).toLocaleDateString()}</Text>
            <Pressable onPress={() => revoke(u)} style={styles.revokeBtn}>
              <Text style={styles.revokeTxt}>REVOKE ACCESS</Text>
            </Pressable>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Pressable onPress={() => setShowModal(false)}><Text style={styles.back}>CANCEL</Text></Pressable>
            <Text style={styles.title}>{mode === 'create' ? 'Create Ministry User' : 'Grant Access to Existing User'}</Text>

            {/* Mode toggle */}
            <View style={styles.modeRow}>
              <Pressable onPress={() => setMode('create')} style={[styles.modeBtn, mode === 'create' && styles.modeBtnOn]}>
                <Text style={[styles.modeTxt, mode === 'create' && styles.modeTxtOn]}>CREATE NEW</Text>
              </Pressable>
              <Pressable onPress={() => setMode('grant')} style={[styles.modeBtn, mode === 'grant' && styles.modeBtnOn]}>
                <Text style={[styles.modeTxt, mode === 'grant' && styles.modeTxtOn]}>GRANT EXISTING</Text>
              </Pressable>
            </View>

            {mode === 'create' ? (
              <Text style={styles.hint}>Creates both the auth account and ministry_access row. Easiest for new users.</Text>
            ) : (
              <Text style={styles.hint}>Use this if the user already has a GAIA account. They log in with their existing password.</Text>
            )}

            <Text style={styles.label}>EMAIL *</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
              style={styles.input} placeholderTextColor={palette.textDim} placeholder="director@ministry.gov.ng" />

            {mode === 'create' ? (
              <>
                <Text style={styles.label}>PASSWORD * (min 6 chars)</Text>
                <TextInput value={password} onChangeText={setPassword} secureTextEntry
                  style={styles.input} placeholderTextColor={palette.textDim} placeholder="••••••" />

                <Text style={styles.label}>FULL NAME</Text>
                <TextInput value={fullName} onChangeText={setFullName}
                  style={styles.input} placeholderTextColor={palette.textDim} placeholder="Adebayo Ogunlesi" />
              </>
            ) : null}

            <Text style={styles.label}>LEVEL *</Text>
            {LEVELS.map(l => (
              <Pressable key={l.id} onPress={() => setLevel(l.id)}
                style={[styles.levelOpt, level === l.id && styles.levelOptOn]}>
                <View style={[styles.radio, level === l.id && styles.radioOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.levelOptTitle}>{l.label}</Text>
                  <Text style={styles.levelOptDesc}>{l.desc}</Text>
                </View>
              </Pressable>
            ))}

            {level === 'state' ? (
              <>
                <Text style={styles.label}>STATE *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
                  {NIGERIAN_STATES.map(s => (
                    <Pressable key={s} onPress={() => setScopeState(s)}
                      style={[styles.chip, scopeState === s && styles.chipOn]}>
                      <Text style={[styles.chipTxt, scopeState === s && styles.chipTxtOn]}>{s}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.label}>ORGANIZATION</Text>
            <TextInput value={organization} onChangeText={setOrganization}
              style={styles.input} placeholderTextColor={palette.textDim} placeholder="Ministry of Agriculture" />

            <Pressable
              onPress={mode === 'create' ? submitCreate : submitGrant}
              disabled={submitting}
              style={[styles.cta, submitting && { opacity: 0.5 }, { marginTop: 20 }]}
            >
              {submitting ? <ActivityIndicator color="#000" /> : (
                <Text style={styles.ctaTxt}>{mode === 'create' ? 'CREATE USER' : 'GRANT ACCESS'}</Text>
              )}
            </Pressable>

            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedTxt: { fontSize: 20, fontWeight: '900', color: '#ff3b5c' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginTop: 12 },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  empty: { fontSize: 13, color: p.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 40 },
  card: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardEmail: { fontSize: 14, fontWeight: '900', color: p.text, flex: 1, paddingRight: 8 },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: p.neon },
  levelTxt: { fontSize: 9, fontWeight: '900', color: p.neon, letterSpacing: 0.5 },
  revokeBtn: { marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#ff3b5c', alignItems: 'center' },
  revokeTxt: { fontSize: 10, fontWeight: '900', color: '#ff3b5c', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  modalSheet: { backgroundColor: p.obsidian, padding: 20, paddingTop: 60, flex: 1 },
  modeRow: { flexDirection: 'row', gap: 6, marginTop: 16, marginBottom: 8 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  modeBtnOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  modeTxt: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  modeTxtOn: { color: p.neon },
  hint: { fontSize: 11, color: p.textMuted, lineHeight: 16, marginBottom: 8, fontStyle: 'italic' },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 8, letterSpacing: 1 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 15 },
  levelOpt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, marginBottom: 8 },
  levelOptOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.08)' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: p.border },
  radioOn: { borderColor: p.neon, backgroundColor: p.neon },
  levelOptTitle: { fontSize: 13, fontWeight: '900', color: p.text },
  levelOptDesc: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipTxt: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTxtOn: { color: p.neon },
});
