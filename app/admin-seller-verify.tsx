import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Modal, Image, Linking, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
type Tab = 'verifications' | 'inspections';

export default function AdminSellerVerify() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const styles = createStyles(palette);

  const [tab, setTab] = useState<Tab>('verifications');
  const [verifications, setVerifications] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selected, setSelected] = useState<any>(null);
  const [precheck, setPrecheck] = useState<any>(null);
  const [tierInfo, setTierInfo] = useState<any>(null);
  const [signedDocs, setSignedDocs] = useState<{ label: string; url: string }[]>([]);

  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [inspectionForm, setInspectionForm] = useState<any>(null);
  const [insForm, setInsForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    inspector1: '',
    inspector1Phone: '',
    inspector2: '',
    inspector2Phone: '',
    area: '',
    compost: false,
    synthetic: false,
    separation: false,
    residuePassed: false,
    observations: '',
  });
  const [insPhotos, setInsPhotos] = useState<string[]>([]);
  const [insVideo, setInsVideo] = useState<string | null>(null);
  const [insSubmitting, setInsSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [{ data: v }, { data: i }] = await Promise.all([
      supabase.from('seller_verifications').select('*').in('status', ['submitted','needs_fix','rejected','approved']).order('updated_at', { ascending: false }).limit(50),
      supabase.from('seller_inspections').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setVerifications(v || []);
    setInspections(i || []);
    setBusy(false);
  }, [isAdmin]);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openDetail = async (v: any) => {
    setSelected(v);
    setPrecheck(null);
    setTierInfo(null);
    setSignedDocs([]);

    const [{ data: pre }, { data: tier }] = await Promise.all([
      supabase.rpc('admin_precheck_verification', { p_verification_id: v.id }),
      supabase.rpc('get_seller_tier_summary', { p_user_id: v.user_id }),
    ]);
    setPrecheck(pre || null);
    setTierInfo(tier || null);

    const { data: docs } = await supabase.from('seller_documents').select('*').eq('verification_id', v.id);
    if (docs) {
      const signed = await Promise.all(
        docs.map(async (d: any) => {
          const { data } = await supabase.storage.from('seller-docs').createSignedUrl(d.file_path, 60 * 60 * 24);
          return { label: d.doc_type, url: data?.signedUrl || '' };
        }),
      );
      setSignedDocs(signed.filter((s: any) => s.url));
    }
  };

  const approveVerification = async (v: any) => {
    Alert.alert('Approve verification?', v.legal_name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        try {
          const { error } = await supabase.rpc('admin_approve_seller_verification', { p_verification_id: v.id });
          if (error) throw error;
          Alert.alert('Approved', 'Seller can now subscribe.');
          setSelected(null);
          await load();
        } catch (e: any) { Alert.alert('Failed', e.message); }
      }},
    ]);
  };

  const rejectVerification = async () => {
    if (!rejectModal || rejectReason.trim().length < 3) { Alert.alert('Reason required'); return; }
    try {
      const { error } = await supabase.rpc('admin_reject_seller_verification', {
        p_verification_id: rejectModal.id, p_reason: rejectReason.trim(),
      });
      if (error) throw error;
      setRejectModal(null); setRejectReason(''); setSelected(null);
      Alert.alert('Rejected');
      await load();
    } catch (e: any) { Alert.alert('Failed', e.message); }
  };

  const pickInsPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!r.canceled) setInsPhotos([...insPhotos, r.assets[0].uri]);
  };

  const pickInsVideo = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'video/*' });
    if (!r.canceled) setInsVideo(r.assets[0].uri);
  };

  const uploadInsFile = async (uri: string, key: string): Promise<string> => {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const ext = (uri.split('.').pop() || 'bin').toLowerCase();
    const path = `inspections/${inspectionForm.user_id}/${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('seller-docs').upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: false });
    if (error) throw error;
    return path;
  };

  const submitInspection = async () => {
    if (!inspectionForm) return;
    if (!insForm.inspector1.trim()) { Alert.alert('Inspector 1 name required'); return; }
    setInsSubmitting(true);
    try {
      const photoPaths: string[] = [];
      for (const p of insPhotos) photoPaths.push(await uploadInsFile(p, 'photo'));
      let videoPath: string | null = null;
      if (insVideo) videoPath = await uploadInsFile(insVideo, 'video');

      const { error } = await supabase.rpc('admin_record_inspection', {
        p_user_id: inspectionForm.user_id,
        p_inspection_date: insForm.date,
        p_inspector_1_name: insForm.inspector1.trim(),
        p_inspector_1_phone: insForm.inspector1Phone.trim() || null,
        p_inspector_2_name: insForm.inspector2.trim() || null,
        p_inspector_2_phone: insForm.inspector2Phone.trim() || null,
        p_farm_area_hectares: insForm.area ? parseFloat(insForm.area) : null,
        p_compost_use: insForm.compost,
        p_synthetic_fertilizer_used: insForm.synthetic,
        p_separation_from_non_organic: insForm.separation,
        p_residue_test_passed: insForm.residuePassed,
        p_residue_report_path: null,
        p_observations: insForm.observations.trim() || null,
        p_photos: photoPaths,
        p_video_path: videoPath,
      });
      if (error) throw error;
      setInspectionForm(null);
      setInsPhotos([]); setInsVideo(null);
      Alert.alert('Recorded');
      await load();
    } catch (e: any) { Alert.alert('Failed', e.message); }
    finally { setInsSubmitting(false); }
  };

  const approveInspection = async (i: any) => {
    try {
      const { error } = await supabase.rpc('admin_approve_inspection', { p_inspection_id: i.id });
      if (error) throw error;
      Alert.alert('Approved');
      await load();
    } catch (e: any) { Alert.alert('Failed', e.message); }
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedTxt}>Access denied</Text></View>;

  const pendingVerifs = verifications.filter(v => v.status === 'submitted');
  const approvedVerifs = verifications.filter(v => v.status === 'approved');
  const pendingIns = inspections.filter(i => i.status === 'submitted');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Seller Verification</Text>
        <Text style={styles.sub}>{pendingVerifs.length} pending · {pendingIns.length} inspections</Text>
      </View>

      <View style={styles.tabRow}>
        {(['verifications','inspections'] as Tab[]).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]}>
            <Text style={[styles.tabTxt, tab === t && { color: '#000' }]}>
              {t === 'verifications' ? `VERIFICATIONS (${pendingVerifs.length})` : `INSPECTIONS (${pendingIns.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>
        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {tab === 'verifications' && !busy ? (
          <>
            <Text style={styles.sectionLbl}>PENDING ({pendingVerifs.length})</Text>
            {pendingVerifs.length === 0 ? <Text style={styles.empty}>No pending verifications.</Text> : null}
            {pendingVerifs.map(v => (
              <Pressable key={v.id} onPress={() => openDetail(v)} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.cardTitle}>{v.legal_name}</Text>
                  {v.updated_at && new Date(v.updated_at) < new Date(Date.now() - 48*3600000) ? (
                    <Text style={{ fontSize: 10, color: '#ffb300', fontWeight: '900' }}>⏱ 48h+</Text>
                  ) : null}
                </View>
                <Text style={styles.cardMeta}>{v.cac_registration} · {v.farm_lga}, {v.farm_state}</Text>
                <Text style={styles.cardMeta}>Submitted {new Date(v.updated_at || v.created_at).toLocaleDateString()}</Text>
              </Pressable>
            ))}

            <Text style={[styles.sectionLbl, { marginTop: 20 }]}>APPROVED ({approvedVerifs.length})</Text>
            {approvedVerifs.map(v => (
              <View key={v.id} style={[styles.card, { opacity: 0.85 }]}>
                <Text style={styles.cardTitle}>✅ {v.legal_name}</Text>
                <Text style={styles.cardMeta}>{v.cac_registration}</Text>
                <Pressable onPress={() => setInspectionForm(v)} style={styles.scheduleBtn}>
                  <Text style={styles.scheduleTxt}>RECORD INSPECTION</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        {tab === 'inspections' && !busy ? (
          <>
            <Text style={styles.sectionLbl}>SUBMITTED ({pendingIns.length})</Text>
            {pendingIns.length === 0 ? <Text style={styles.empty}>No submitted inspections.</Text> : null}
            {pendingIns.map(i => (
              <View key={i.id} style={styles.card}>
                <Text style={styles.cardTitle}>{i.inspector_1_name}{i.inspector_2_name ? ` + ${i.inspector_2_name}` : ''}</Text>
                <Text style={styles.cardMeta}>{new Date(i.inspection_date).toLocaleDateString()} · {i.farm_area_hectares || '?'} ha</Text>
                <Text style={styles.cardMeta}>Compost: {i.compost_use ? '✅' : '—'} · Synthetic: {i.synthetic_fertilizer_used ? '❌' : 'none'} · Separation: {i.separation_from_non_organic ? '✅' : '—'}</Text>
                {Array.isArray(i.photos) && i.photos.length > 0 ? <Text style={styles.cardMeta}>📷 {i.photos.length} photo(s)</Text> : null}
                {i.video_path ? <Text style={styles.cardMeta}>🎥 Video attached</Text> : null}
                <Pressable onPress={() => approveInspection(i)} style={styles.approveBtn}>
                  <Text style={styles.approveTxt}>APPROVE INSPECTION</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Detail modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>{selected?.legal_name}</Text>
              {precheck ? (
                <View style={[styles.riskPill, { backgroundColor: precheck.risk_level === 'high' ? '#ff3b5c' : precheck.risk_level === 'medium' ? '#ffb300' : palette.neon }]}>
                  <Text style={styles.riskTxt}>{precheck.risk_level.toUpperCase()} RISK</Text>
                </View>
              ) : null}
            </View>

            {precheck ? (
              <>
                <Text style={styles.sectionLbl}>PRE-CHECK</Text>
                <View style={styles.block}>
                  <Row ok={precheck.document_count >= 3} text={`${precheck.document_count}/3 required documents`} />
                  <Row ok={precheck.bank_matches_cac} text="Bank name matches CAC" />
                  <Row ok={precheck.gps_valid} text="GPS within Nigeria" />
                  <Row ok={precheck.nin_duplicate_count === 0} text={precheck.nin_duplicate_count === 0 ? 'NIN unique' : `NIN used by ${precheck.nin_duplicate_count} other(s)`} />
                  <Row ok={precheck.cac_duplicate_count === 0} text={precheck.cac_duplicate_count === 0 ? 'CAC unique' : `CAC used by ${precheck.cac_duplicate_count} other(s)`} />
                  <Row ok={precheck.account_age_days >= 3} text={`Account age: ${precheck.account_age_days} days`} />
                  <Row ok={precheck.applicant_age >= 18} text={`Applicant age: ${precheck.applicant_age}`} />
                </View>

                {precheck.active_subscription ? (
                  <>
                    <Text style={styles.sectionLbl}>ACTIVE SUBSCRIPTION</Text>
                    <View style={styles.block}>
                      <KV k="Tier" v={precheck.active_subscription.tier_name} />
                      <KV k="Commission" v={`${precheck.active_subscription.commission_pct}%`} />
                      <KV k="Expires" v={new Date(precheck.active_subscription.period_end).toLocaleDateString()} />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.sectionLbl}>SUBSCRIPTION</Text>
                    <Text style={styles.hint}>No active subscription yet.</Text>
                  </>
                )}
              </>
            ) : null}

            <Text style={styles.sectionLbl}>IDENTITY</Text>
            <View style={styles.block}>
              <KV k="Legal name" v={selected?.legal_name || '—'} />
              <KV k="DOB" v={selected?.date_of_birth || '—'} />
              <KV k="NIN" v={selected?.nin || '—'} mono />
              <KV k="CAC" v={selected?.cac_registration || '—'} mono />
            </View>

            <Text style={styles.sectionLbl}>BANK</Text>
            <View style={styles.block}>
              <KV k="Bank" v={selected?.bank_name || '—'} />
              <KV k="Account" v={selected?.bank_account_number || '—'} mono />
              <KV k="Account name" v={selected?.bank_account_name || '—'} />
            </View>

            <Text style={styles.sectionLbl}>FARM</Text>
            <View style={styles.block}>
              <KV k="State/LGA" v={`${selected?.farm_state || '—'} / ${selected?.farm_lga || '—'}`} />
              <KV k="Address" v={selected?.farm_address || '—'} />
              <KV k="GPS" v={selected?.farm_gps_lat != null ? `${selected.farm_gps_lat}, ${selected.farm_gps_lon}` : '—'} mono
                action={selected?.farm_gps_lat != null ? () => Linking.openURL(`https://maps.google.com/?q=${selected.farm_gps_lat},${selected.farm_gps_lon}`) : undefined} actionLabel="Map" />
            </View>

            <Text style={styles.sectionLbl}>DOCUMENTS ({signedDocs.length})</Text>
            {signedDocs.length === 0 ? <Text style={styles.hint}>No documents uploaded.</Text> : null}
            {signedDocs.map((d, idx) => (
              <Pressable key={idx} onPress={() => Linking.openURL(d.url)} style={styles.docRow}>
                <Text style={styles.docLabel}>📄 {d.label}</Text>
                <Text style={styles.docOpen}>OPEN →</Text>
              </Pressable>
            ))}

            {selected?.status === 'submitted' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
                <Pressable onPress={() => { setRejectModal(selected); setRejectReason(''); }} style={[styles.bigBtn, { borderColor: '#ff3b5c' }]}>
                  <Text style={[styles.bigBtnTxt, { color: '#ff3b5c' }]}>REJECT</Text>
                </Pressable>
                <Pressable onPress={() => approveVerification(selected)} style={[styles.bigBtn, { borderColor: palette.neon, backgroundColor: palette.neon }]}>
                  <Text style={[styles.bigBtnTxt, { color: '#000' }]}>APPROVE</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Reject modal */}
      <Modal visible={!!rejectModal} transparent animationType="slide">
        <View style={styles.modalBgCenter}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject verification</Text>
            <TextInput value={rejectReason} onChangeText={setRejectReason} multiline placeholder="Reason shown to seller…" placeholderTextColor={palette.textDim} style={styles.notesInput} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable onPress={() => setRejectModal(null)} style={[styles.bigBtn, { borderColor: palette.border }]}>
                <Text style={[styles.bigBtnTxt, { color: palette.text }]}>CANCEL</Text>
              </Pressable>
              <Pressable onPress={rejectVerification} style={[styles.bigBtn, { borderColor: '#ff3b5c' }]}>
                <Text style={[styles.bigBtnTxt, { color: '#ff3b5c' }]}>REJECT</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Inspection form */}
      <Modal visible={!!inspectionForm} transparent animationType="slide">
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Pressable onPress={() => setInspectionForm(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.modalTitle}>Record Inspection</Text>
            <Text style={styles.cardMeta}>{inspectionForm?.legal_name}</Text>

            <Text style={styles.label}>INSPECTION DATE</Text>
            <TextInput value={insForm.date} onChangeText={d => setInsForm(s => ({ ...s, date: d }))} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>INSPECTOR 1 NAME *</Text>
            <TextInput value={insForm.inspector1} onChangeText={v => setInsForm(s => ({ ...s, inspector1: v }))} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>INSPECTOR 1 PHONE</Text>
            <TextInput value={insForm.inspector1Phone} onChangeText={v => setInsForm(s => ({ ...s, inspector1Phone: v }))} keyboardType="phone-pad" style={styles.input} placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>INSPECTOR 2 NAME (for organic)</Text>
            <TextInput value={insForm.inspector2} onChangeText={v => setInsForm(s => ({ ...s, inspector2: v }))} style={styles.input} placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>FARM AREA (HECTARES)</Text>
            <TextInput value={insForm.area} onChangeText={v => setInsForm(s => ({ ...s, area: v }))} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />

            <Pressable onPress={() => setInsForm(s => ({ ...s, compost: !s.compost }))} style={styles.toggleRow}>
              <Text style={styles.toggleLbl}>Compost use observed</Text><Text style={styles.toggleVal}>{insForm.compost ? '✅' : '—'}</Text>
            </Pressable>
            <Pressable onPress={() => setInsForm(s => ({ ...s, synthetic: !s.synthetic }))} style={styles.toggleRow}>
              <Text style={styles.toggleLbl}>Synthetic fertilizer used</Text><Text style={styles.toggleVal}>{insForm.synthetic ? '❌' : 'none'}</Text>
            </Pressable>
            <Pressable onPress={() => setInsForm(s => ({ ...s, separation: !s.separation }))} style={styles.toggleRow}>
              <Text style={styles.toggleLbl}>Separated from non-organic</Text><Text style={styles.toggleVal}>{insForm.separation ? '✅' : '—'}</Text>
            </Pressable>
            <Pressable onPress={() => setInsForm(s => ({ ...s, residuePassed: !s.residuePassed }))} style={styles.toggleRow}>
              <Text style={styles.toggleLbl}>Residue test passed</Text><Text style={styles.toggleVal}>{insForm.residuePassed ? '✅' : '—'}</Text>
            </Pressable>

            <Text style={styles.label}>FARM PHOTOS ({insPhotos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {insPhotos.map((uri, i) => <Image key={i} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />)}
                <Pressable onPress={pickInsPhoto} style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.neon, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 24, color: palette.neon }}>+</Text>
                </Pressable>
              </View>
            </ScrollView>

            <Text style={styles.label}>FARM VIDEO (walkthrough)</Text>
            <Pressable onPress={pickInsVideo} style={{ padding: 14, borderRadius: 10, backgroundColor: insVideo ? 'rgba(0,255,136,0.15)' : palette.surface, borderWidth: 1, borderColor: insVideo ? palette.neon : palette.border, alignItems: 'center' }}>
              <Text style={{ color: palette.neon, fontWeight: '900' }}>{insVideo ? '✓ VIDEO ATTACHED' : '🎥 ATTACH VIDEO'}</Text>
            </Pressable>

            <Text style={styles.label}>OBSERVATIONS</Text>
            <TextInput value={insForm.observations} onChangeText={v => setInsForm(s => ({ ...s, observations: v }))} multiline style={[styles.input, { minHeight: 80 }]} placeholderTextColor={palette.textDim} />

            <Pressable onPress={submitInspection} disabled={insSubmitting} style={[styles.bigBtn, { borderColor: palette.neon, backgroundColor: palette.neon, marginTop: 20, flex: 0 }]}>
              {insSubmitting ? <ActivityIndicator color="#000" /> : <Text style={[styles.bigBtnTxt, { color: '#000' }]}>SUBMIT INSPECTION</Text>}
            </Pressable>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Row({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 5, alignItems: 'flex-start' }}>
      <Text style={{ fontSize: 13 }}>{ok ? '✅' : '⚠️'}</Text>
      <Text style={{ flex: 1, fontSize: 12, color: ok ? '#fff' : '#ffb300' }}>{text}</Text>
    </View>
  );
}

function KV({ k, v, mono, action, actionLabel }: any) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 6, alignItems: 'center' }}>
      <Text style={{ fontSize: 12, color: '#888', width: 110 }}>{k}</Text>
      <Text style={{ flex: 1, fontSize: 13, color: '#fff', fontFamily: mono ? 'monospace' : undefined }}>{v}</Text>
      {action ? <Pressable onPress={action} style={{ paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#00ff88', borderRadius: 6 }}><Text style={{ fontSize: 10, color: '#00ff88', fontWeight: '900' }}>{actionLabel}</Text></Pressable> : null}
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
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabActive: { backgroundColor: p.neon, borderColor: p.neon },
  tabTxt: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  sectionLbl: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginBottom: 8, marginTop: 12 },
  empty: { fontSize: 13, color: p.textMuted, fontStyle: 'italic', marginBottom: 8 },
  hint: { fontSize: 12, color: p.textMuted, fontStyle: 'italic', marginBottom: 8 },
  card: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: p.text },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  scheduleBtn: { marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: p.neon, alignItems: 'center' },
  scheduleTxt: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  approveBtn: { marginTop: 10, padding: 12, borderRadius: 8, backgroundColor: p.neon, alignItems: 'center' },
  approveTxt: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 1 },
  riskPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  riskTxt: { fontSize: 9, fontWeight: '900', color: '#000', letterSpacing: 1 },
  block: { backgroundColor: p.surface, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  modalBgCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: p.obsidian, padding: 20, paddingTop: 60, flex: 1 },
  modalCard: { backgroundColor: p.surface, padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: p.text, marginBottom: 12, flex: 1 },
  notesInput: { padding: 12, borderRadius: 10, backgroundColor: p.obsidian, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 13, minHeight: 80, textAlignVertical: 'top' },
  input: { padding: 12, borderRadius: 10, backgroundColor: p.surface, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 14, marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 12, marginBottom: 6, letterSpacing: 1 },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  docLabel: { fontSize: 13, color: p.text },
  docOpen: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  bigBtn: { flex: 1, paddingVertical: 14, borderWidth: 2, borderRadius: 10, alignItems: 'center' },
  bigBtnTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.border },
  toggleLbl: { fontSize: 13, color: p.text },
  toggleVal: { fontSize: 13, fontWeight: '900', color: p.neon },
});
