import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

const REASONS = [
  'Blurry or unclear',
  'Cut off / incomplete',
  'Wrong document type',
  'Expired document',
  'Face not clearly visible',
  'Selfie does not match ID',
  'Name on ID does not match profile',
  'Other (specify below)',
];

export default function AdminFarmers() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [rejecting, setRejecting] = useState<{ doc: 'id' | 'selfie' } | null>(null);
  const [reason, setReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [actionBusy, setActionBusy] = useState(false);
  const [nameMatches, setNameMatches] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const { data } = await supabase
        .from('farmer_verifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setRows(data || []);
    } catch {}
    setBusy(false);
  };

  useEffect(() => {
    if (user?.email?.toLowerCase() === ADMIN_EMAIL) load();
  }, [user]);

  const openUser = (r: any) => {
    setNameMatches(false);
    setSelected(r);
  };

  const refreshSelected = async (id: string) => {
    const { data } = await supabase.from('farmer_verifications').select('*').eq('id', id).maybeSingle();
    if (data) setSelected(data);
  };

  const approveAll = async () => {
    if (!selected) return;
    Alert.alert('Approve verification?', 'Both documents will be marked approved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        setActionBusy(true);
        const { error } = await supabase.rpc('admin_approve_verification', { p_verification_id: selected.id });
        setActionBusy(false);
        if (error) { Alert.alert('Failed', error.message); return; }
        Alert.alert('Approved', 'User is now verified.');
        await refreshSelected(selected.id);
        load();
      }},
    ]);
  };

  const submitReject = async () => {
    if (!selected || !rejecting) return;
    const finalReason = reason === 'Other (specify below)' ? customReason.trim() : reason;
    if (!finalReason) { Alert.alert('Reason required', 'Please pick or type a reason.'); return; }

    setActionBusy(true);
    const payload: any = {
      p_verification_id: selected.id,
      p_reject_id: rejecting.doc === 'id',
      p_reject_selfie: rejecting.doc === 'selfie',
      p_id_reason: rejecting.doc === 'id' ? finalReason : null,
      p_selfie_reason: rejecting.doc === 'selfie' ? finalReason : null,
    };
    const { error } = await supabase.rpc('admin_reject_documents', payload);
    setActionBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    setRejecting(null);
    setReason('');
    setCustomReason('');
    await refreshSelected(selected.id);
    load();
  };

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  const filtered = search.trim()
    ? rows.filter((r) => {
        const hay = ((r.full_name || '') + ' ' + (r.state || '') + ' ' + (r.phone || '')).toLowerCase();
        return hay.includes(search.toLowerCase());
      })
    : rows;

  const docColor = (s?: string) => {
    if (s === 'rejected') return palette.danger;
    if (s === 'approved') return palette.neon;
    return palette.warning;
  };

  const DocPanel = ({ label, uri, status, reasonText }: any) => (
    <View style={styles.docWrap}>
      <Text style={styles.docLabel}>{label}</Text>
      {uri ? (
        <Image source={{ uri }} style={styles.docImg} />
      ) : (
        <View style={[styles.docImg, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={styles.docMissing}>No photo</Text>
        </View>
      )}
      <View style={[styles.docStatus, { borderColor: docColor(status) }]}>
        <Text style={[styles.docStatusTxt, { color: docColor(status) }]}>{(status || 'pending').toUpperCase()}</Text>
      </View>
      {status === 'rejected' && reasonText ? (
        <Text style={styles.docReason}>{reasonText}</Text>
      ) : null}
      {uri ? (
        <Pressable
          onPress={() => setRejecting({ doc: label === 'ID DOCUMENT' ? 'id' : 'selfie' })}
          style={[styles.rejectDoc, { borderColor: palette.danger }]}
        >
          <Text style={[styles.rejectDocTxt, { color: palette.danger }]}>REJECT THIS</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (selected) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>{selected.full_name || 'Unknown'}</Text>
          <Text style={styles.sub}>{(selected.status || 'pending').toUpperCase()}</Text>

          <View style={styles.detailCard}>
            <Text style={styles.detailRow}><Text style={styles.k}>Phone: </Text>{selected.phone || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>State: </Text>{selected.state || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>LGA: </Text>{selected.lga || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>Address: </Text>{selected.address || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>BVN: </Text>{selected.bvn || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>NIN: </Text>{selected.nin || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>Crop: </Text>{selected.crop || '—'}</Text>
            <Text style={styles.detailRow}><Text style={styles.k}>Farm size: </Text>{selected.farm_size || '—'}</Text>
          </View>

          <Text style={styles.sectionLabel}>DOCUMENTS</Text>

          <View style={styles.nameChip}>
            <Text style={styles.nameChipLbl}>REVIEWING FOR</Text>
            <Text style={styles.nameChipName}>{selected.full_name || 'Unknown'}</Text>
            <Text style={styles.nameChipMeta}>
              {selected.state || '-'} · {selected.phone || '-'} · REF {String(selected.id || '').slice(0, 8)}
            </Text>
          </View>

          <Pressable
            onPress={() => setNameMatches(!nameMatches)}
            style={[styles.checkRow, nameMatches && styles.checkRowOn]}
          >
            <View style={[styles.checkBox, nameMatches && styles.checkBoxOn]}>
              {nameMatches ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkLabel}>
                Name on ID matches profile name
              </Text>
              <Text style={styles.checkMeta}>
                Confirm the name on the ID matches "{selected.full_name || 'the profile'}"
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setRejecting({ doc: 'id' })}
            style={[styles.mismatchBtn, { borderColor: palette.warning }]}
          >
            <Text style={[styles.mismatchBtnTxt, { color: palette.warning }]}>
              ✕ NAME MISMATCH — REJECT
            </Text>
          </Pressable>

          <View style={styles.docRow}>
            <DocPanel
              label="ID DOCUMENT"
              uri={selected.id_photo_url || selected.id_image_url}
              status={selected.id_status || 'pending'}
              reasonText={selected.id_rejection_reason}
            />
            <DocPanel
              label="SELFIE"
              uri={selected.selfie_url}
              status={selected.selfie_status || 'pending'}
              reasonText={selected.selfie_rejection_reason}
            />
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={approveAll}
              disabled={actionBusy || !nameMatches}
              style={[styles.approve, (actionBusy || !nameMatches) && { opacity: 0.4 }]}
            >
              <Text style={styles.approveTxt}>
                {actionBusy ? 'WORKING...' : !nameMatches ? 'CONFIRM NAME MATCH FIRST' : 'APPROVE ALL'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>
            Tip: to reject only one document, tap REJECT THIS under that document above.
          </Text>

          <Modal visible={!!rejecting} transparent animationType="slide" onRequestClose={() => setRejecting(null)}>
            <View style={styles.modalBg}>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>
                  Reject {rejecting?.doc === 'id' ? 'ID document' : 'selfie'}
                </Text>
                <Text style={styles.modalSub}>Pick a reason. The farmer will see this and re-upload.</Text>

                {REASONS.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setReason(r)}
                    style={[styles.reasonRow, reason === r && styles.reasonRowOn]}
                  >
                    <Text style={[styles.reasonTxt, reason === r && styles.reasonTxtOn]}>{r}</Text>
                  </Pressable>
                ))}

                {reason === 'Other (specify below)' ? (
                  <TextInput
                    value={customReason}
                    onChangeText={setCustomReason}
                    placeholder="Type the reason..."
                    placeholderTextColor={palette.textDim}
                    style={styles.reasonInput}
                  />
                ) : null}

                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => { setRejecting(null); setReason(''); setCustomReason(''); }}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelTxt}>CANCEL</Text>
                  </Pressable>
                  <Pressable
                    onPress={submitReject}
                    disabled={actionBusy}
                    style={[styles.sendReject, actionBusy && { opacity: 0.5 }]}
                  >
                    <Text style={styles.sendRejectTxt}>{actionBusy ? 'SENDING...' : 'SEND REJECTION'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Farmer Database</Text>
        <Text style={styles.sub}>{rows.length} records</Text>

        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, state, phone..."
            placeholderTextColor={palette.textDim}
            style={styles.search}
          />
        </View>

        {busy ? <Text style={styles.loading}>Loading...</Text> : null}

        {filtered.map((r, i) => {
          const ok = r.status === 'approved';
          const pending = r.status === 'pending' || r.status === 'pending_payment';
          const rejected = r.status === 'documents_rejected';
          const color = ok ? palette.neon : rejected ? palette.danger : pending ? palette.warning : palette.textMuted;
          return (
            <Pressable key={i} onPress={() => openUser(r)} style={styles.card}>
              {r.selfie_url ? (
                <Image source={{ uri: r.selfie_url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: palette.textMuted, fontSize: 10 }}>NO PHOTO</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{r.full_name || 'Unknown'}</Text>
                <Text style={styles.detail} numberOfLines={1}>{r.state || '-'} · {r.phone || '-'}</Text>
                <Text style={[styles.statusTag, { color, borderColor: color }]}>{(r.status || 'pending').replace('_', ' ').toUpperCase()}</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          );
        })}
        {filtered.length === 0 && !busy ? <Text style={styles.loading}>No records.</Text> : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  searchWrap: { marginBottom: 16 },
  search: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: p.text, fontSize: 14 },
  loading: { fontSize: 13, color: p.textMuted, textAlign: 'center', paddingVertical: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: p.abyss },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  detail: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  statusTag: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', overflow: 'hidden' },
  chev: { fontSize: 22, color: p.textDim },
  detailCard: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  detailRow: { fontSize: 13, color: p.text, marginBottom: 8 },
  k: { color: p.neon, fontWeight: '800' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 10 },
  docRow: { flexDirection: 'row', gap: 12 },
  docWrap: { flex: 1 },
  docLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: p.textMuted, marginBottom: 6 },
  docImg: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: p.abyss },
  docMissing: { fontSize: 12, color: p.textDim },
  docStatus: { marginTop: 8, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' },
  docStatusTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  docReason: { fontSize: 10, color: p.danger, marginTop: 6, fontStyle: 'italic' },
  rejectDoc: { marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  rejectDocTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  approve: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  approveTxt: { fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  hint: { fontSize: 11, color: p.textMuted, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: p.text },
  modalSub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  reasonRow: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, marginBottom: 6 },
  reasonRowOn: { borderColor: p.danger, backgroundColor: 'rgba(255,59,92,0.1)' },
  reasonTxt: { fontSize: 13, color: p.text },
  reasonTxtOn: { color: p.danger, fontWeight: '800' },
  reasonInput: { marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, color: p.text, fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  cancelTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: p.text },
  sendReject: { flex: 2, padding: 14, borderRadius: 10, backgroundColor: p.danger, alignItems: 'center' },
  sendRejectTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: '#fff' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
