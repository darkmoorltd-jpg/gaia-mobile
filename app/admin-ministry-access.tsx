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
  { id: 'federal', label: 'Federal Ministry', desc: 'All states' },
  { id: 'ifad', label: 'IFAD', desc: 'All states' },
  { id: 'state', label: 'State Ministry', desc: 'One state only' },
];

export default function AdminMinistryAccess() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const styles = createStyles(palette);

  const [grants, setGrants] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showGrant, setShowGrant] = useState(false);

  const [email, setEmail] = useState('');
  const [level, setLevel] = useState('federal');
  const [scopeState, setScopeState] = useState('Lagos');
  const [org, setOrg] = useState('');
  const [notes, setNotes] = useState('');
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data } = await supabase.from('ministry_access')
      .select('*').order('granted_at', { ascending: false });
    setGrants(data || []);
    setBusy(false);
  }, [isAdmin]);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!email.trim()) { Alert.alert('Email required'); return; }
    if (level === 'state' && !scopeState) { Alert.alert('State required for state-level access'); return; }
    setGranting(true);
    try {
      const { data, error } = await supabase.rpc('admin_grant_ministry_access', {
        p_email: email.trim().toLowerCase(),
        p_level: level,
        p_scope_state: level === 'state' ? scopeState : null,
        p_scope_lga: null,
        p_organization: org.trim() || null,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error('Grant failed');
      Alert.alert('Access granted', `User ${email} can now access ministry dashboard.`);
      setShowGrant(false);
      setEmail(''); setOrg(''); setNotes('');
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setGranting(false);
    }
  };

  const revoke = (g: any) => {
    Alert.alert('Revoke access?', g.email, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'REVOKE', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.rpc('admin_revoke_ministry_access', { p_access_id: g.id });
          if (error) throw error;
          await load();
          Alert.alert('Revoked');
        } catch (e: any) { Alert.alert('Failed', e.message); }
      }},
    ]);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedTxt}>Access denied</Text></View>;

  const active = grants.filter(g => g.is_active);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Ministry Access</Text>
        <Text style={styles.sub}>{active.length} active · {grants.length} total</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>

        <Pressable onPress={() => setShowGrant(true)} style={styles.cta}>
          <Text style={styles.ctaTxt}>+ GRANT NEW ACCESS</Text>
        </Pressable>

        <Text style={styles.sectionLbl}>ACTIVE GRANTS ({active.length})</Text>
        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {!busy && active.length === 0 ? <Text style={styles.empty}>No active ministry access. Grant one above.</Text> : null}

        {active.map(g => (
          <View key={g.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{g.email}</Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelTxt}>{g.level.toUpperCase()}</Text>
              </View>
            </View>
            {g.scope_state ? <Text style={styles.cardMeta}>State: {g.scope_state}</Text> : <Text style={styles.cardMeta}>All states</Text>}
            {g.organization ? <Text style={styles.cardMeta}>Org: {g.organization}</Text> : null}
            <Text style={styles.cardMeta}>Granted {new Date(g.granted_at).toLocaleDateString()}</Text>
            <Pressable onPress={() => revoke(g)} style={styles.revokeBtn}>
              <Text style={styles.revokeTxt}>REVOKE</Text>
            </Pressable>
          </View>
        ))}

        <Text style={[styles.sectionLbl, { marginTop: 20 }]}>INACTIVE</Text>
        {grants.filter(g => !g.is_active).map(g => (
          <View key={g.id} style={[styles.card, { opacity: 0.6 }]}>
            <Text style={styles.cardTitle} numberOfLines={1}>{g.email}</Text>
            <Text style={styles.cardMeta}>{g.level.toUpperCase()} · revoked {new Date(g.revoked_at || g.updated_at).toLocaleDateString()}</Text>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={showGrant} transparent animationType="slide" onRequestClose={() => setShowGrant(false)}>
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Pressable onPress={() => setShowGrant(false)}><Text style={styles.back}>CANCEL</Text></Pressable>
            <Text style={styles.title}>Grant Ministry Access</Text>

            <Text style={styles.label}>EMAIL *</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholderTextColor={palette.textDim} placeholder="user@ministry.gov.ng" />

            <Text style={styles.label}>LEVEL *</Text>
            {LEVELS.map(l => (
              <Pressable key={l.id} onPress={() => setLevel(l.id)} style={[styles.levelOpt, level === l.id && styles.levelOptOn]}>
                <View style={[styles.radio, level === l.id && styles.radioOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.levelName}>{l.label}</Text>
                  <Text style={styles.levelDesc}>{l.desc}</Text>
                </View>
              </Pressable>
            ))}

            {level === 'state' ? (
              <>
                <Text style={styles.label}>STATE *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
                  {NIGERIAN_STATES.map(s => (
                    <Pressable key={s} onPress={() => setScopeState(s)} style={[styles.chip, scopeState === s && styles.chipOn]}>
                      <Text style={[styles.chipTxt, scopeState === s && styles.chipTxtOn]}>{s}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.label}>ORGANIZATION</Text>
            <TextInput value={org} onChangeText={setOrg} style={styles.input} placeholderTextColor={palette.textDim} placeholder="Federal Ministry of Agriculture" />

            <Pressable onPress={submit} disabled={granting} style={[styles.cta, granting && { opacity: 0.5 }]}>
              {granting ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>GRANT ACCESS</Text>}
            </Pressable>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedTxt: { fontSize: 18, fontWeight: '900', color: '#ff3b5c' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginTop: 12 },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  sectionLbl: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 24, marginBottom: 12 },
  empty: { fontSize: 13, color: p.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  card: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: p.text, flex: 1, paddingRight: 8 },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(0,255,136,0.15)', borderWidth: 1, borderColor: p.neon },
  levelTxt: { fontSize: 9, fontWeight: '900', color: p.neon, letterSpacing: 0.5 },
  revokeBtn: { marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#ff3b5c', alignItems: 'center' },
  revokeTxt: { fontSize: 10, fontWeight: '900', color: '#ff3b5c', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  modalSheet: { backgroundColor: p.obsidian, padding: 20, paddingTop: 60, flex: 1 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 8, letterSpacing: 1 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 15 },
  levelOpt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, marginBottom: 8 },
  levelOptOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.08)' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: p.border },
  radioOn: { borderColor: p.neon, backgroundColor: p.neon },
  levelName: { fontSize: 13, fontWeight: '900', color: p.text },
  levelDesc: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipTxt: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTxtOn: { color: p.neon },
});
