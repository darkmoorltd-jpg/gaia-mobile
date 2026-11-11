
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert, Modal, Image, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const fmt = (s?: string) => s ? new Date(s).toLocaleString() : '—';

type Tab = 'pending' | 'approved' | 'rejected' | 'all';

export default function AdminInputProviders() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState<Tab>('pending');
  const [providers, setProviders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data } = await supabase.rpc('admin_list_input_providers', { p_status: tab });
    setProviders(Array.isArray(data) ? data : []);
    setBusy(false); setRef(false);
  }, [isAdmin, tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const approve = (p: any) => {
    const missing: string[] = [];
    if (!p.cac_certificate_url) missing.push('CAC Certificate');
    if (!p.owner_id_url) missing.push('Owner ID');
    if (!p.bank_statement_url) missing.push('Bank Statement');
    if (!p.consent_form_url) missing.push('Consent Form');

    if (missing.length > 0) {
      Alert.alert('Cannot approve', 'Missing documents: ' + missing.join(', ') + '. Ask the provider to re-upload.');
      return;
    }

    Alert.alert(
      'Approve provider?',
      `${p.business_name} will be able to accept orders.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'APPROVE', onPress: async () => {
          setActing(true);
          const { error } = await supabase.rpc('admin_approve_input_provider', { p_id: p.id });
          setActing(false);
          if (error) { Alert.alert('Failed', error.message); return; }
          Alert.alert('Approved', `${p.business_name} is now live.`);
          setSelected(null);
          load();
        }},
      ],
    );
  };

  const reject = (p: any) => {
    Alert.prompt(
      'Reject provider?',
      'Enter the reason (shown to the provider):',
      async (reason?: string) => {
        if (!reason || !reason.trim()) return;
        setActing(true);
        const { error } = await supabase.rpc('admin_reject_input_provider', { p_id: p.id, p_reason: reason.trim() });
        setActing(false);
        if (error) { Alert.alert('Failed', error.message); return; }
        Alert.alert('Rejected', `${p.business_name} was rejected.`);
        setSelected(null);
        load();
      },
      'plain-text',
      '',
    );
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const TAB_LABELS: Record<Tab, string> = { pending: 'PENDING', approved: 'APPROVED', rejected: 'REJECTED', all: 'ALL' };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#b388ff" />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Input Providers</Text>
        <Text style={styles.sub}>{providers.length} provider(s)</Text>

        <View style={styles.tabBar}>
          {(['pending','approved','rejected','all'] as Tab[]).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnOn]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{TAB_LABELS[t]}</Text>
            </Pressable>
          ))}
        </View>

        {busy && providers.length === 0 ? <ActivityIndicator color="#b388ff" /> : null}
        {!busy && providers.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No {tab} providers.</Text></View>
        ) : null}

        {providers.map(p => {
          const statusColor = p.status === 'approved' ? '#00ff88' : (p.status === 'rejected' ? '#ff3b5c' : '#ffb300');
          const docsCount = [p.cac_certificate_url, p.owner_id_url, p.bank_statement_url, p.consent_form_url].filter(Boolean).length;
          const docsColor = docsCount === 4 ? '#00ff88' : docsCount > 0 ? '#ffb300' : '#ff3b5c';
          return (
            <Pressable key={p.id} onPress={() => setSelected(p)} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{p.business_name}</Text>
                <Text style={styles.meta} numberOfLines={1}>{p.user_email}</Text>
                <Text style={styles.meta} numberOfLines={1}>📍 {p.city || '—'}, {p.state || '—'}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <View style={[styles.chip, { borderColor: statusColor }]}>
                    <Text style={[styles.chipText, { color: statusColor }]}>{p.status.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.chip, { borderColor: docsColor }]}>
                    <Text style={[styles.chipText, { color: docsColor }]}>DOCS {docsCount}/4</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{(p.tier_id || 'starter').toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable onPress={() => setSelected(null)}>
                <Text style={styles.back}>CLOSE</Text>
              </Pressable>
              <Text style={styles.title} numberOfLines={2}>{selected?.business_name}</Text>
              <Text style={styles.sub}>{selected?.user_email}</Text>

              <Text style={styles.sectionLabel}>BUSINESS</Text>
              <Text style={styles.kv}><Text style={styles.k}>CAC: </Text>{selected?.business_reg_number || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Categories: </Text>{(selected?.categories || []).join(', ') || '—'}</Text>

              <Text style={styles.sectionLabel}>LOCATION</Text>
              <Text style={styles.kv}><Text style={styles.k}>Address: </Text>{selected?.address || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>City: </Text>{selected?.city || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>LGA: </Text>{selected?.lga || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>State: </Text>{selected?.state || '—'}</Text>

              {selected?.gps_lat && selected?.gps_lon ? (
                <Pressable
                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${selected.gps_lat},${selected.gps_lon}`)}
                  style={styles.mapBtn}
                >
                  <Text style={styles.mapBtnText}>🗺️ View Store on Google Maps ({selected.gps_lat.toFixed(4)}, {selected.gps_lon.toFixed(4)})</Text>
                </Pressable>
              ) : (
                <Text style={[styles.kv, { color: '#ff3b5c' }]}>⚠️ No GPS location captured</Text>
              )}

              <Text style={styles.sectionLabel}>CONTACT</Text>
              <Text style={styles.kv}><Text style={styles.k}>Phone: </Text>{selected?.phone || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>WhatsApp: </Text>{selected?.whatsapp || '—'}</Text>

              <Text style={styles.sectionLabel}>BANK</Text>
              <Text style={styles.kv}><Text style={styles.k}>Bank: </Text>{selected?.bank_name || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Account #: </Text>{selected?.bank_account_number || '—'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Account Name: </Text>{selected?.bank_account_name || '—'}</Text>

              <Text style={styles.sectionLabel}>KYC DOCUMENTS — CHECKLIST</Text>
              <View style={styles.checklist}>
                <View style={styles.checkRow}>
                  <Text style={selected?.cac_certificate_url ? styles.checkOn : styles.checkOff}>{selected?.cac_certificate_url ? '✓' : '✗'}</Text>
                  <Text style={styles.checkLabel}>CAC Certificate</Text>
                </View>
                <View style={styles.checkRow}>
                  <Text style={selected?.owner_id_url ? styles.checkOn : styles.checkOff}>{selected?.owner_id_url ? '✓' : '✗'}</Text>
                  <Text style={styles.checkLabel}>Owner ID</Text>
                </View>
                <View style={styles.checkRow}>
                  <Text style={selected?.bank_statement_url ? styles.checkOn : styles.checkOff}>{selected?.bank_statement_url ? '✓' : '✗'}</Text>
                  <Text style={styles.checkLabel}>Bank Statement</Text>
                </View>
                <View style={styles.checkRow}>
                  <Text style={selected?.consent_form_url ? styles.checkOn : styles.checkOff}>{selected?.consent_form_url ? '✓' : '✗'}</Text>
                  <Text style={styles.checkLabel}>Signed Consent Form</Text>
                </View>
              </View>
              {selected?.consent_agreed_at ? (
                <Text style={[styles.kv, { marginTop: 8, fontSize: 11, color: '#00ff88' }]}>
                  ✅ Consent recorded: {fmt(selected.consent_agreed_at)}
                </Text>
              ) : null}

              <Text style={styles.sectionLabel}>UPLOADED DOCUMENTS</Text>
              {selected?.cac_certificate_url ? (
                <View style={styles.docBlock}>
                  <Text style={styles.docTitle}>CAC Certificate</Text>
                  <Pressable onPress={() => Linking.openURL(selected.cac_certificate_url)}>
                    <Image source={{ uri: selected.cac_certificate_url }} style={styles.docImage} resizeMode="cover" />
                  </Pressable>
                  <Text style={styles.docLink}>Tap image to enlarge →</Text>
                </View>
              ) : null}
              {selected?.owner_id_url ? (
                <View style={styles.docBlock}>
                  <Text style={styles.docTitle}>Owner ID</Text>
                  <Pressable onPress={() => Linking.openURL(selected.owner_id_url)}>
                    <Image source={{ uri: selected.owner_id_url }} style={styles.docImage} resizeMode="cover" />
                  </Pressable>
                  <Text style={styles.docLink}>Tap image to enlarge →</Text>
                </View>
              ) : null}
              {selected?.bank_statement_url ? (
                <View style={styles.docBlock}>
                  <Text style={styles.docTitle}>Bank Statement</Text>
                  <Pressable onPress={() => Linking.openURL(selected.bank_statement_url)}>
                    <Image source={{ uri: selected.bank_statement_url }} style={styles.docImage} resizeMode="cover" />
                  </Pressable>
                  <Text style={styles.docLink}>Tap image to enlarge →</Text>
                </View>
              ) : null}
              {selected?.consent_form_url ? (
                <View style={styles.docBlock}>
                  <Text style={styles.docTitle}>Signed Consent Form</Text>
                  <Pressable onPress={() => Linking.openURL(selected.consent_form_url)}>
                    <Image source={{ uri: selected.consent_form_url }} style={styles.docImage} resizeMode="cover" />
                  </Pressable>
                  <Text style={styles.docLink}>Tap image to enlarge →</Text>
                </View>
              ) : null}

              <Text style={styles.sectionLabel}>STORE PHOTOS</Text>
              {(selected?.store_images || []).length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {(selected?.store_images || []).map((img: string, i: number) => (
                    <Pressable key={i} onPress={() => Linking.openURL(img)}>
                      <Image source={{ uri: img }} style={styles.storeImage} />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.noImages}>No store photos uploaded.</Text>
              )}

              <Text style={styles.sectionLabel}>STATUS</Text>
              <Text style={styles.kv}><Text style={styles.k}>Status: </Text>{(selected?.status || '').toUpperCase()}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Tier: </Text>{(selected?.tier_id || 'starter').toUpperCase()}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Fee Paid: </Text>{selected?.onboarding_fee_paid ? 'YES' : 'NO'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Applied: </Text>{fmt(selected?.created_at)}</Text>
              {selected?.rejection_reason ? (
                <Text style={styles.kv}><Text style={styles.k}>Rejection: </Text>{selected.rejection_reason}</Text>
              ) : null}

              {selected?.status === 'pending' ? (
                <>
                  <Text style={styles.sectionLabel}>DECISION</Text>
                  <Pressable disabled={acting} onPress={() => approve(selected)} style={[styles.approveBtn, acting && { opacity: 0.5 }]}>
                    <Text style={styles.approveTxt}>✅ APPROVE PROVIDER</Text>
                  </Pressable>
                  <Pressable disabled={acting} onPress={() => reject(selected)} style={[styles.rejectBtn, acting && { opacity: 0.5 }]}>
                    <Text style={styles.rejectTxt}>❌ REJECT PROVIDER</Text>
                  </Pressable>
                </>
              ) : selected?.status === 'rejected' ? (
                <>
                  {selected?.resubmission_requested ? (
                    <Pressable
                      disabled={acting}
                      onPress={async () => {
                        setActing(true);
                        await supabase.from('input_providers').update({
                          status: 'needs_resubmission',
                          resubmission_requested: false
                        }).eq('id', selected.id);
                        setActing(false);
                        setSelected(null);
                        load();
                        Alert.alert('Allowed', 'Provider can now edit and resubmit.');
                      }}
                      style={[styles.approveBtn, acting && { opacity: 0.5 }, { marginTop: 16, backgroundColor: '#3b82f6' }]}
                    >
                      <Text style={[styles.approveTxt, { color: '#fff' }]}>🔄 ALLOW RESUBMISSION</Text>
                    </Pressable>
                  ) : (
                    <Pressable disabled={acting} onPress={() => approve(selected)} style={[styles.approveBtn, acting && { opacity: 0.5 }, { marginTop: 16 }]}>
                      <Text style={styles.approveTxt}>✅ RE-APPROVE</Text>
                    </Pressable>
                  )}
                </>
              ) : null}

              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  tabBar: { flexDirection: 'row', gap: 4, marginBottom: 16, backgroundColor: p.surface, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  tabBtnOn: { backgroundColor: 'rgba(179,136,255,0.15)' },
  tabText: { fontSize: 10, fontWeight: '800', color: p.textDim, letterSpacing: 0.5 },
  tabTextOn: { color: '#b388ff' },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyText: { fontSize: 12, color: p.textMuted },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: p.border },
  chipText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: p.textMuted },
  chevron: { fontSize: 22, color: p.textDim },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '94%' },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#b388ff', marginTop: 20, marginBottom: 8 },
  kv: { fontSize: 13, color: p.text, marginBottom: 6 },
  k: { color: p.textMuted, fontWeight: '700' },
  mapBtn: { marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: 'rgba(179,136,255,0.1)', borderWidth: 1, borderColor: '#b388ff', alignItems: 'center' },
  mapBtnText: { fontSize: 12, fontWeight: '800', color: '#b388ff' },
  checklist: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: p.border },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkOn: { fontSize: 16, fontWeight: '900', color: '#00ff88', width: 24 },
  checkOff: { fontSize: 16, fontWeight: '900', color: '#ff3b5c', width: 24 },
  checkLabel: { fontSize: 13, color: p.text },
  docBlock: { marginTop: 12 },
  docTitle: { fontSize: 12, fontWeight: '800', color: p.text, marginBottom: 6 },
  docImage: { width: '100%', height: 200, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.2)' },
  docLink: { fontSize: 11, color: '#b388ff', fontWeight: '700', marginTop: 6 },
  storeImage: { width: 140, height: 100, borderRadius: 10, marginRight: 8 },
  noImages: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', marginTop: 6 },
  approveBtn: { padding: 16, borderRadius: 12, backgroundColor: '#00ff88', alignItems: 'center', marginTop: 10 },
  approveTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  rejectBtn: { padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#ff3b5c', alignItems: 'center', marginTop: 8 },
  rejectTxt: { fontSize: 13, fontWeight: '900', color: '#ff3b5c', letterSpacing: 1 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
