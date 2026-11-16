import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Modal, Image, Linking, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

const MANDATORY = ['docs_match_cac', 'bank_matches_cac', 'has_real_photo'] as const;
const OPTIONAL = ['spoke_to_contact', 'called_ref_1', 'called_ref_2'] as const;
const ALL_ITEMS = [...MANDATORY, ...OPTIONAL];

const ITEM_LABELS: Record<string, string> = {
  docs_match_cac: 'Documents match CAC name',
  bank_matches_cac: 'Bank account name matches CAC',
  has_real_photo: 'At least 1 document is a photo (not scan)',
  spoke_to_contact: 'Spoke to contact by phone',
  called_ref_1: 'Called reference 1',
  called_ref_2: 'Called reference 2',
};

const SLOT_LABELS: Record<string, string> = {
  cac_cert: 'CAC Certificate',
  tin_cert: 'TIN Certificate',
  director_id: 'Director ID',
  utility_bill: 'Utility Bill',
  letterhead: 'Letterhead + Stamp',
};

const REJECT_REASONS = [
  'CAC number does not match documents',
  'Bank account name does not match CAC',
  'Documents illegible or incomplete',
  'Could not reach contact',
  'Other (explain below)',
];

export default function AdminWarehouseDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [company, setCompany] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [signedDocs, setSignedDocs] = useState<{ slot: string; url: string; ext: string }[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

  const [docModal, setDocModal] = useState<number | null>(null);
  const [decision, setDecision] = useState<null | 'approved' | 'rejected' | 'requested_info'>(null);
  const [reason, setReason] = useState('');
  const [allowResubmit, setAllowResubmit] = useState(true);
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin || !id) return;
    setBusy(true);
    try {
      const [{ data: co }, { data: acts }] = await Promise.all([
        supabase.from('warehouse_companies').select('*').eq('id', id).maybeSingle(),
        supabase.from('warehouse_review_actions').select('*').eq('company_id', id).order('created_at', { ascending: false }).limit(30),
      ]);
      setCompany(co);
      setActivities(acts || []);
      if (co?.admin_notes != null) setNotes(co.admin_notes);
      setNotesDirty(false);

      // Signed URLs for documents
      const docs = Array.isArray(co?.documents) ? co!.documents : [];
      if (docs.length > 0) {
        const signed = await Promise.all(
          docs.map(async (d: any) => {
            const { data } = await supabase.storage.from('warehouse-docs').createSignedUrl(d.path, 60 * 60 * 24);
            const ext = (d.path || '').split('.').pop()?.toLowerCase() || 'jpg';
            return { slot: d.slot, url: data?.signedUrl || '', ext };
          }),
        );
        setSignedDocs(signed.filter(s => s.url));
      } else {
        setSignedDocs([]);
      }
    } finally {
      setBusy(false);
    }
  }, [isAdmin, id]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  // Initial load + mark viewed
  useEffect(() => {
    (async () => {
      await load();
      if (id) { try { await supabase.rpc('admin_mark_viewed', { p_company_id: id }); } catch {} }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: refresh on any change to this company
  useEffect(() => {
    if (!isAdmin || !id) return;
    const ch = supabase.channel(`admin_wh_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'warehouse_companies', filter: `id=eq.${id}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, id, load]);

  const checklist = company?.checklist || {};
  const isDone = (k: string) => checklist[k]?.done === true;
  const mandatoryDone = MANDATORY.every(isDone);
  const doneCount = ALL_ITEMS.filter(isDone).length;

  const toggleCheck = async (key: string) => {
    if (!company) return;
    const next = { ...checklist };
    if (next[key]?.done) { delete next[key]; }
    else { next[key] = { done: true, by: user?.id, at: new Date().toISOString() }; }
    setCompany({ ...company, checklist: next });
    try {
      await supabase.rpc('admin_save_checklist', { p_company_id: company.id, p_checklist: next });
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
      await load();
    }
  };

  const saveNotes = async () => {
    if (!company) return;
    try {
      await supabase.rpc('admin_save_notes', { p_company_id: company.id, p_notes: notes });
      setNotesDirty(false);
      await load();
    } catch (e: any) {
      Alert.alert('Notes save failed', e.message);
    }
  };

  const submitDecision = async () => {
    if (!company || !decision) return;
    if ((decision === 'rejected' || decision === 'requested_info') && reason.trim().length < 3) {
      Alert.alert('Reason required', 'Enter at least a few characters.');
      return;
    }
    if (decision === 'approved' && !mandatoryDone) {
      Alert.alert('Cannot approve', 'Complete the 3 mandatory checklist items first.');
      return;
    }
    setDeciding(true);
    try {
      const { error } = await supabase.rpc('admin_review_warehouse', {
        p_company_id: company.id,
        p_action: decision,
        p_reason: decision === 'approved' ? null : reason.trim(),
        p_allow_resubmit: decision !== 'approved' ? allowResubmit : false,
      });
      if (error) throw error;
      setDecision(null);
      setReason('');
      setAllowResubmit(true);
      await load();
      Alert.alert(
        decision === 'approved' ? 'Approved' :
        decision === 'rejected' ? 'Rejected' :
        'Info requested',
        decision === 'approved'
          ? 'Applicant can now pay the ₦20,000 registration fee.'
          : 'Applicant has been notified.',
      );
    } catch (e: any) {
      Alert.alert('Decision failed', e.message);
    } finally {
      setDeciding(false);
    }
  };

  if (!isAdmin) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }
  if (busy && !company) {
    return <View style={styles.blocked}><ActivityIndicator color={palette.neon} /></View>;
  }
  if (!company) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>Not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: palette.textMuted }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const statusColor =
    company.verification_status === 'approved' ? palette.neon :
    company.verification_status === 'pending' ? '#ffb300' :
    company.verification_status === 'needs_info' ? '#3b82f6' :
    company.verification_status === 'rejected' ? '#ff3b5c' : '#888';

  const sla = (() => {
    if (company.reviewed_at) return null;
    const hours = Math.floor((Date.now() - new Date(company.created_at).getTime()) / 3600000);
    return hours;
  })();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.title} numberOfLines={1}>{company.company_name}</Text>
          {sla != null ? (
            <Text style={[styles.slaTxt, { color: sla >= 48 ? '#ff3b5c' : sla >= 24 ? '#ffb300' : palette.neon }]}>
              ⏱ {sla}h
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusTxt, { color: statusColor }]}>
              {String(company.verification_status).replace('_',' ').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.meta}>{company.cac_registration || '—'}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}
      >
        {/* VERIFICATION STATUS */}
        <Text style={styles.sectionLabel}>VERIFICATION STATUS</Text>
        <View style={styles.block}>
          <Row ok={!!company.cac_verified_at} text={
            company.cac_verified_at
              ? `CAC verified${company.cac_verified_name ? ` as "${company.cac_verified_name}"` : ''}`
              : 'CAC not auto-verified — check documents manually'
          } />
          <Row ok={!!company.bank_verified_at} text={
            company.bank_verified_at
              ? `Bank verified on ${new Date(company.bank_verified_at).toLocaleDateString()}`
              : 'Bank not verified'
          } />
          <Row ok={signedDocs.length > 0} text={`${signedDocs.length} of ${Array.isArray(company.documents) ? company.documents.length : 0} documents uploaded`} />
          <Row ok={!!company.agreement_signed_at} text={
            company.agreement_signed_at
              ? `Agreement signed ${new Date(company.agreement_signed_at).toLocaleDateString()} — "${company.agreement_signature || ''}" (v${company.agreement_version || '?'})`
              : 'Agreement not signed'
          } />
          <Row ok={!!company.registration_fee_paid_at} text={
            company.registration_fee_paid_at
              ? `₦${Number(company.registration_fee_amount || 20000).toLocaleString()} registration fee paid`
              : 'Registration fee not paid (applicant pays after approval)'
          } />
        </View>

        {/* COMPANY */}
        <Text style={styles.sectionLabel}>COMPANY</Text>
        <View style={styles.block}>
          <KV k="Name" v={company.company_name} />
          <KV k="CAC" v={company.cac_registration} mono />
          <KV k="TIN" v={company.tin || '—'} mono />
          <KV k="Years" v={String(company.years_in_business ?? 0)} />
        </View>

        {/* CONTACT */}
        <Text style={styles.sectionLabel}>CONTACT</Text>
        <View style={styles.block}>
          <KV k="Name" v={company.contact_person || '—'} />
          <KV k="Role" v={company.contact_role || '—'} />
          <KV k="Phone" v={company.contact_phone || '—'} action={() => Linking.openURL(`tel:${company.contact_phone}`)} actionLabel="Call" />
          <KV k="Email" v={company.contact_email || '—'} action={() => Linking.openURL(`mailto:${company.contact_email}`)} actionLabel="Mail" />
        </View>

        {/* LOCATION */}
        <Text style={styles.sectionLabel}>LOCATION</Text>
        <View style={styles.block}>
          <KV k="State" v={company.state || '—'} />
          <KV k="Address" v={company.address || '—'} />
          {company.head_office_lat != null && company.head_office_lon != null ? (
            <KV
              k="GPS"
              v={`${Number(company.head_office_lat).toFixed(6)}, ${Number(company.head_office_lon).toFixed(6)}`}
              mono
              action={() => Linking.openURL(`https://maps.google.com/?q=${company.head_office_lat},${company.head_office_lon}`)}
              actionLabel="Map"
            />
          ) : (
            <KV k="GPS" v="Not captured" />
          )}
        </View>

        {/* DOCUMENTS */}
        <Text style={styles.sectionLabel}>DOCUMENTS ({signedDocs.length})</Text>
        <View style={styles.docsGrid}>
          {signedDocs.length === 0 ? (
            <Text style={styles.emptyText}>No documents uploaded.</Text>
          ) : signedDocs.map((d, i) => (
            <Pressable key={i} onPress={() => setDocModal(i)} style={styles.docTile}>
              {d.ext === 'pdf' ? (
                <Text style={styles.docIcon}>📄</Text>
              ) : (
                <Image source={{ uri: d.url }} style={styles.docThumb} />
              )}
              <Text style={styles.docLabel} numberOfLines={2}>
                {SLOT_LABELS[d.slot] || d.slot}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* BANK */}
        <Text style={styles.sectionLabel}>BANK ACCOUNT</Text>
        <View style={styles.block}>
          <KV k="Bank" v={company.bank_name || '—'} />
          <KV k="Account" v={company.bank_account_number || '—'} mono />
          <KV k="Account name" v={company.bank_account_name || '—'} />
          <KV k="Verified" v={company.bank_verified_at ? new Date(company.bank_verified_at).toLocaleDateString() : 'Not verified'} />
        </View>

        {/* CAPACITY */}
        <Text style={styles.sectionLabel}>CAPACITY</Text>
        <View style={styles.block}>
          <KV k="Total tonnes" v={company.total_capacity_tonnes != null ? String(company.total_capacity_tonnes) : '—'} />
          <KV k="Facilities" v={String(company.facility_count ?? 0)} />
          <KV k="Unit types" v={Array.isArray(company.unit_types) && company.unit_types.length ? company.unit_types.map((t: string) => t.toUpperCase()).join(', ') : '—'} />
        </View>

        {/* REFERENCES */}
        <Text style={styles.sectionLabel}>REFERENCES</Text>
        <View style={styles.block}>
          {company.reference_1 ? (
            <>
              <KV k="Ref 1 — Name" v={company.reference_1.name} />
              <KV k="Ref 1 — Phone" v={company.reference_1.phone} action={() => Linking.openURL(`tel:${company.reference_1.phone}`)} actionLabel="Call" />
            </>
          ) : <Text style={styles.emptyText}>No reference 1 provided</Text>}
          {company.reference_2 ? (
            <>
              <KV k="Ref 2 — Name" v={company.reference_2.name} />
              <KV k="Ref 2 — Phone" v={company.reference_2.phone} action={() => Linking.openURL(`tel:${company.reference_2.phone}`)} actionLabel="Call" />
            </>
          ) : null}
        </View>

        {/* NOTES */}
        <Text style={styles.sectionLabel}>ADMIN NOTES (internal)</Text>
        <TextInput
          value={notes}
          onChangeText={t => { setNotes(t); setNotesDirty(true); }}
          multiline
          placeholder="Internal notes — not visible to applicant"
          placeholderTextColor={palette.textDim}
          style={styles.notesInput}
        />
        {notesDirty ? (
          <Pressable onPress={saveNotes} style={styles.saveNotesBtn}>
            <Text style={styles.saveNotesTxt}>SAVE NOTES</Text>
          </Pressable>
        ) : null}

        {/* CHECKLIST */}
        <Text style={styles.sectionLabel}>VERIFICATION CHECKLIST ({doneCount}/6)</Text>
        <View style={styles.block}>
          <Text style={styles.checkGroup}>MANDATORY (blocks approval)</Text>
          {MANDATORY.map(k => (
            <Pressable key={k} onPress={() => toggleCheck(k)} style={styles.checkRow}>
              <View style={[styles.checkbox, isDone(k) && styles.checkboxOn]}>
                {isDone(k) ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkLabel}>{ITEM_LABELS[k]}</Text>
            </Pressable>
          ))}
          <Text style={[styles.checkGroup, { marginTop: 12 }]}>OPTIONAL</Text>
          {OPTIONAL.map(k => (
            <Pressable key={k} onPress={() => toggleCheck(k)} style={styles.checkRow}>
              <View style={[styles.checkbox, isDone(k) && styles.checkboxOn]}>
                {isDone(k) ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkLabel}>{ITEM_LABELS[k]}</Text>
            </Pressable>
          ))}
        </View>

        {/* ACTIVITY LOG */}
        <Text style={styles.sectionLabel}>ACTIVITY LOG</Text>
        <View style={styles.block}>
          {activities.length === 0 ? <Text style={styles.emptyText}>No activity yet.</Text> : activities.map(a => (
            <View key={a.id} style={styles.actRow}>
              <View style={styles.actDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.actAction}>{a.action.toUpperCase()}</Text>
                {a.details?.reason ? <Text style={styles.actDetail}>"{a.details.reason}"</Text> : null}
                <Text style={styles.actTime}>{new Date(a.created_at).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* DECISION BUTTONS */}
        {company.verification_status !== 'approved' ? (
          <>
            <Text style={styles.sectionLabel}>DECISION</Text>
            <View style={styles.decisionRow}>
              <Pressable onPress={() => setDecision('rejected')} style={[styles.decBtn, { borderColor: '#ff3b5c' }]}>
                <Text style={[styles.decTxt, { color: '#ff3b5c' }]}>REJECT</Text>
              </Pressable>
              <Pressable onPress={() => setDecision('requested_info')} style={[styles.decBtn, { borderColor: '#3b82f6' }]}>
                <Text style={[styles.decTxt, { color: '#3b82f6' }]}>REQUEST INFO</Text>
              </Pressable>
              <Pressable
                onPress={() => mandatoryDone ? setDecision('approved') : Alert.alert('Cannot approve', 'Complete the 3 mandatory checklist items first.')}
                style={[styles.decBtn, { borderColor: palette.neon, backgroundColor: mandatoryDone ? palette.neon : 'transparent' }]}
              >
                <Text style={[styles.decTxt, { color: mandatoryDone ? '#000' : palette.neon }]}>APPROVE</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* DOCUMENT MODAL */}
      <Modal visible={docModal != null} transparent animationType="fade" onRequestClose={() => setDocModal(null)}>
        <View style={styles.docModalBg}>
          <View style={styles.docModalHeader}>
            <Pressable onPress={() => setDocModal(null)}><Text style={styles.docModalClose}>✕</Text></Pressable>
            <Text style={styles.docModalTitle}>
              {docModal != null ? (SLOT_LABELS[signedDocs[docModal]?.slot] || signedDocs[docModal]?.slot) : ''}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {docModal != null && signedDocs[docModal] ? (
            <>
              {signedDocs[docModal].ext === 'pdf' ? (
                <View style={styles.pdfWrap}>
                  <Text style={{ fontSize: 60 }}>📄</Text>
                  <Text style={styles.pdfHint}>PDF document</Text>
                  <Pressable
                    onPress={() => Linking.openURL(signedDocs[docModal!].url)}
                    style={styles.pdfBtn}
                  >
                    <Text style={styles.pdfBtnTxt}>OPEN IN BROWSER</Text>
                  </Pressable>
                </View>
              ) : (
                <Image
                  source={{ uri: signedDocs[docModal].url }}
                  style={styles.docFull}
                  resizeMode="contain"
                />
              )}

              <View style={styles.docNav}>
                <Pressable
                  disabled={docModal === 0}
                  onPress={() => setDocModal(docModal! - 1)}
                  style={[styles.docNavBtn, docModal === 0 && { opacity: 0.3 }]}
                >
                  <Text style={styles.docNavTxt}>← PREV</Text>
                </Pressable>
                <Text style={styles.docCount}>{docModal + 1} / {signedDocs.length}</Text>
                <Pressable
                  disabled={docModal === signedDocs.length - 1}
                  onPress={() => setDocModal(docModal! + 1)}
                  style={[styles.docNavBtn, docModal === signedDocs.length - 1 && { opacity: 0.3 }]}
                >
                  <Text style={styles.docNavTxt}>NEXT →</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </Modal>

      {/* DECISION MODAL */}
      <Modal visible={!!decision} transparent animationType="slide">
        <View style={styles.decModalBg}>
          <View style={styles.decModalCard}>
            <Text style={styles.decModalTitle}>
              {decision === 'approved' ? 'Approve application?' :
               decision === 'rejected' ? 'Reject application' :
               'Request more info'}
            </Text>

            {decision === 'approved' ? (
              <Text style={styles.decModalHint}>
                Applicant will be able to pay the ₦20,000 registration fee and start listing units.
                Checklist: {doneCount}/6 ({mandatoryDone ? 'all mandatory done ✓' : 'MANDATORY INCOMPLETE'}).
              </Text>
            ) : (
              <>
                <Text style={styles.decModalLabel}>REASON (shown to applicant)</Text>
                {REJECT_REASONS.map(r => (
                  <Pressable
                    key={r}
                    onPress={() => setReason(prev => prev === r ? '' : r)}
                    style={styles.reasonRow}
                  >
                    <View style={[styles.radio, reason === r && styles.radioOn]}>
                      {reason === r ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text style={styles.reasonTxt}>{r}</Text>
                  </Pressable>
                ))}

                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  placeholder="Additional detail…"
                  placeholderTextColor={palette.textDim}
                  style={styles.reasonInput}
                />

                <Pressable onPress={() => setAllowResubmit(a => !a)} style={styles.resubmitRow}>
                  <View style={[styles.checkbox, allowResubmit && styles.checkboxOn]}>
                    {allowResubmit ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.resubmitTxt}>Allow applicant to edit and resubmit</Text>
                </Pressable>
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
              <Pressable onPress={() => { setDecision(null); setReason(''); }} style={[styles.decModalBtn, { borderColor: palette.border }]}>
                <Text style={[styles.decModalBtnTxt, { color: palette.text }]}>CANCEL</Text>
              </Pressable>
              <Pressable
                onPress={submitDecision}
                disabled={deciding}
                style={[styles.decModalBtn, {
                  borderColor: decision === 'approved' ? palette.neon : decision === 'rejected' ? '#ff3b5c' : '#3b82f6',
                  backgroundColor: decision === 'approved' ? palette.neon : 'transparent',
                }]}
              >
                {deciding ? <ActivityIndicator color={decision === 'approved' ? '#000' : palette.text} /> : (
                  <Text style={[styles.decModalBtnTxt, { color: decision === 'approved' ? '#000' : decision === 'rejected' ? '#ff3b5c' : '#3b82f6' }]}>
                    {decision === 'approved' ? 'CONFIRM APPROVE' :
                     decision === 'rejected' ? 'CONFIRM REJECT' :
                     'SEND REQUEST'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 6, alignItems: 'flex-start' }}>
      <Text style={{ fontSize: 14 }}>{ok ? '✅' : '⏳'}</Text>
      <Text style={{ flex: 1, fontSize: 12, color: ok ? '#fff' : '#ffb300' }}>{text}</Text>
    </View>
  );
}

function KV({ k, v, mono, action, actionLabel }: { k: string; v: string; mono?: boolean; action?: () => void; actionLabel?: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 6, alignItems: 'center' }}>
      <Text style={{ fontSize: 12, color: '#888', width: 110 }}>{k}</Text>
      <Text style={{ flex: 1, fontSize: 13, color: '#fff', fontFamily: mono ? 'monospace' : undefined }}>{v}</Text>
      {action ? (
        <Pressable onPress={action} style={{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#00ff88', borderRadius: 6 }}>
          <Text style={{ fontSize: 10, color: '#00ff88', fontWeight: '900' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: '#ff3b5c' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: p.text, flex: 1 },
  slaTxt: { fontSize: 13, fontWeight: '900', marginLeft: 8 },
  meta: { fontSize: 12, color: p.textMuted, fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1.5 },
  statusTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 24, marginBottom: 8 },
  block: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border },
  emptyText: { fontSize: 12, color: p.textMuted, fontStyle: 'italic' },
  docsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  docTile: { width: '30%', aspectRatio: 0.85, backgroundColor: p.surface, borderRadius: 10, borderWidth: 1, borderColor: p.border, padding: 6, alignItems: 'center', justifyContent: 'center' },
  docThumb: { width: '100%', height: '70%', borderRadius: 6, resizeMode: 'cover' },
  docIcon: { fontSize: 36, marginVertical: 8 },
  docLabel: { fontSize: 10, color: p.text, textAlign: 'center', marginTop: 4, fontWeight: '700' },
  notesInput: { padding: 12, borderRadius: 10, backgroundColor: p.surface, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 13, minHeight: 80, textAlignVertical: 'top' },
  saveNotesBtn: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: p.neon, borderRadius: 8 },
  saveNotesTxt: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 1 },
  checkGroup: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { borderColor: p.neon, backgroundColor: p.neon },
  checkMark: { fontSize: 14, fontWeight: '900', color: '#000' },
  checkLabel: { flex: 1, fontSize: 13, color: p.text },
  actRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  actDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.neon, marginTop: 5 },
  actAction: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  actDetail: { fontSize: 11, color: p.text, marginTop: 2, fontStyle: 'italic' },
  actTime: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  decisionRow: { flexDirection: 'row', gap: 8 },
  decBtn: { flex: 1, paddingVertical: 14, borderWidth: 2, borderRadius: 10, alignItems: 'center' },
  decTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  docModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)' },
  docModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60 },
  docModalClose: { fontSize: 24, color: '#fff', width: 40 },
  docModalTitle: { fontSize: 15, fontWeight: '900', color: '#fff' },
  docFull: { flex: 1, width: '100%' },
  pdfWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  pdfHint: { fontSize: 14, color: '#888' },
  pdfBtn: { paddingHorizontal: 24, paddingVertical: 14, backgroundColor: p.neon, borderRadius: 10 },
  pdfBtnTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
  docNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 40 },
  docNavBtn: { paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#fff', borderRadius: 8 },
  docNavTxt: { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  docCount: { fontSize: 13, color: '#888', fontWeight: '800' },
  decModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  decModalCard: { backgroundColor: p.surface, padding: 20, borderRadius: 16, maxHeight: '85%' },
  decModalTitle: { fontSize: 20, fontWeight: '900', color: p.text, marginBottom: 12 },
  decModalHint: { fontSize: 13, color: p.textMuted, lineHeight: 20, marginBottom: 16 },
  decModalLabel: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: p.neon },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.neon },
  reasonTxt: { flex: 1, fontSize: 13, color: p.text },
  reasonInput: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: p.obsidian, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 13, minHeight: 60, textAlignVertical: 'top' },
  resubmitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  resubmitTxt: { flex: 1, fontSize: 12, color: p.text },
  decModalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  decModalBtnTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});
