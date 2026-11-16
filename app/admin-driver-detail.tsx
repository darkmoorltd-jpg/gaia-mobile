import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Modal, Image, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const CHECK_ITEMS = ['license_verified', 'nin_verified', 'vehicle_docs_verified', 'documents_expiry_ok', 'bank_matches_name'] as const;
const LABELS: Record<string, string> = {
  license_verified: 'License photo matches license number and DOB',
  nin_verified: 'NIN slip readable and matches name',
  vehicle_docs_verified: 'Vehicle documents match plate',
  documents_expiry_ok: 'Insurance and road worthiness not expired',
  bank_matches_name: 'Bank account name matches driver name',
};

type DocKey = 'license_url' | 'license_back_url' | 'nin_slip_url' | 'registration_doc_url' | 'insurance_cert_url' | 'road_worthiness_url' | 'photo_front_url' | 'photo_rear_url';

export default function AdminDriverDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [driver, setDriver] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);

  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [docModal, setDocModal] = useState<{ url: string; label: string } | null>(null);

  const [decision, setDecision] = useState<null | 'active' | 'suspended' | 'rejected'>(null);
  const [reason, setReason] = useState('');
  const [deciding, setDeciding] = useState(false);

  const [wdModal, setWdModal] = useState<any>(null);
  const [wdReason, setWdReason] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin || !id) return;
    setBusy(true);
    try {
      const [{ data: drv }, { data: veh }, { data: prof }, { data: wds }, { data: tps }] = await Promise.all([
        supabase.from('driver_profiles').select('*').eq('user_id', id).maybeSingle(),
        supabase.from('vehicles').select('*').eq('driver_id', id).maybeSingle(),
        supabase.from('user_profiles').select('first_name, last_name, phone, email, state, lga').eq('user_id', id).maybeSingle(),
        supabase.from('driver_withdrawals').select('*').eq('driver_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('batch_movements').select('id, status, quantity_kg, delivery_fee, created_at, batches(batch_code, crop_name)').eq('driver_id', id).order('created_at', { ascending: false }).limit(10),
      ]);
      setDriver(drv); setVehicle(veh); setProfile(prof);
      setWithdrawals(wds || []); setTrips(tps || []);
      if (drv?.admin_notes) setNotes(drv.admin_notes);
      setNotesDirty(false);

      // Sign all doc URLs
      const docFields: { key: DocKey; label: string }[] = [
        { key: 'license_url', label: 'License Front' },
        { key: 'license_back_url', label: 'License Back' },
        { key: 'nin_slip_url', label: 'NIN Slip' },
      ];
      const vDocFields: { key: DocKey; label: string }[] = [
        { key: 'registration_doc_url', label: 'Vehicle Registration' },
        { key: 'insurance_cert_url', label: 'Insurance Certificate' },
        { key: 'road_worthiness_url', label: 'Road Worthiness' },
        { key: 'photo_front_url', label: 'Vehicle Front Photo' },
        { key: 'photo_rear_url', label: 'Vehicle Rear Photo' },
      ];

      const signOne = async (path: string) => {
        const clean = path.split('/').pop();
        const { data: s } = await supabase.storage.from('driver-docs').createSignedUrl(clean!, 60 * 60 * 24);
        return s?.signedUrl || '';
      };

      const signedMap: Record<string, string> = {};
      for (const f of docFields) {
        const val = drv?.[f.key];
        if (val) signedMap[f.label] = await signOne(String(val));
      }
      for (const f of vDocFields) {
        const val = veh?.[f.key];
        if (val) signedMap[f.label] = await signOne(String(val));
      }
      setSigned(signedMap);
    } finally { setBusy(false); }
  }, [isAdmin, id]);

  useEffect(() => {
    (async () => {
      await load();
      if (id) { try { await supabase.rpc('admin_mark_viewed', { p_company_id: id }); } catch {} }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const checklist = driver?.checklist || {};
  const isDone = (k: string) => checklist[k]?.done === true;
  const allDone = CHECK_ITEMS.every(isDone);
  const doneCount = CHECK_ITEMS.filter(isDone).length;

  const toggleCheck = async (k: string) => {
    if (!driver) return;
    const next = { ...checklist };
    if (next[k]?.done) delete next[k];
    else next[k] = { done: true, by: user?.id, at: new Date().toISOString() };
    setDriver({ ...driver, checklist: next });
    await supabase.from('driver_profiles').update({ checklist: next }).eq('user_id', driver.user_id);
  };

  const saveNotes = async () => {
    if (!driver) return;
    await supabase.from('driver_profiles').update({ admin_notes: notes }).eq('user_id', driver.user_id);
    setNotesDirty(false); await load();
  };

  const submitDecision = async () => {
    if (!driver || !decision) return;
    if (decision !== 'active' && reason.trim().length < 3) return Alert.alert('Reason required');
    if (decision === 'active' && !allDone) return Alert.alert('Checklist incomplete', 'Complete all 5 mandatory items.');
    setDeciding(true);
    try {
      const { error } = await supabase.rpc('admin_review_driver', {
        p_user_id: driver.user_id, p_action: decision, p_reason: decision === 'active' ? null : reason.trim(),
      });
      if (error) throw error;
      setDecision(null); setReason(''); await load();
      Alert.alert('Updated');
    } catch (e: any) { Alert.alert('Failed', e.message); }
    finally { setDeciding(false); }
  };

  const approveWd = async (w: any) => { try { await supabase.rpc('admin_approve_withdrawal', { p_id: w.id }); await load(); } catch (e: any) { Alert.alert('Failed', e.message); } };
  const completeWd = async (w: any) => { try { await supabase.rpc('admin_complete_withdrawal', { p_id: w.id }); await load(); } catch (e: any) { Alert.alert('Failed', e.message); } };
  const rejectWd = async () => {
    if (!wdModal || wdReason.trim().length < 3) return Alert.alert('Reason required');
    try { await supabase.rpc('admin_reject_withdrawal', { p_id: wdModal.id, p_reason: wdReason.trim() }); setWdModal(null); setWdReason(''); await load(); }
    catch (e: any) { Alert.alert('Failed', e.message); }
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  if (busy && !driver) return <View style={styles.blocked}><ActivityIndicator color={palette.neon} /></View>;
  if (!driver) return <View style={styles.blocked}><Text style={styles.blockedText}>Not found</Text></View>;

  const statusColor = driver.status === 'active' ? palette.neon : driver.status === 'pending' ? '#ffb300' : driver.status === 'suspended' ? '#3b82f6' : '#ff3b5c';

  const expiryWarn = (date: string | null | undefined) => {
    if (!date) return null;
    const days = Math.floor((new Date(date).getTime() - Date.now()) / 86400000);
    if (days < 0) return { text: `EXPIRED ${Math.abs(days)}d ago`, color: '#ff3b5c' };
    if (days < 60) return { text: `Expires in ${days}d`, color: '#ffb300' };
    return { text: new Date(date).toLocaleDateString(), color: palette.neon };
  };

  const licExpiry = expiryWarn(driver.license_expiry);
  const insExpiry = expiryWarn(vehicle?.insurance_expiry);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.title}>{profile?.first_name} {profile?.last_name}</Text>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusTxt, { color: statusColor }]}>{String(driver.status).toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.meta}>{profile?.phone} · {profile?.state || '—'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionLabel}>VERIFICATION STATUS</Text>
        <View style={styles.block}>
          <Row ok={!!driver.agreement_signed_at} text={driver.agreement_signed_at ? `Agreement signed — "${driver.agreement_signature}"` : 'Agreement not signed'} />
          <Row ok={!!driver.nin} text={driver.nin ? `NIN: ${driver.nin}` : 'NIN missing'} />
          <Row ok={!!driver.bank_verified_at} text={driver.bank_verified_at ? `Bank verified: ${driver.bank_verified_name || driver.bank_account_name}` : 'Bank not auto-verified'} />
          <Row ok={licExpiry?.color === palette.neon} text={licExpiry ? `License: ${licExpiry.text}` : 'License expiry unknown'} />
          <Row ok={insExpiry?.color === palette.neon} text={insExpiry ? `Insurance: ${insExpiry.text}` : 'Insurance expiry unknown'} />
        </View>

        <Text style={styles.sectionLabel}>PERSONAL</Text>
        <View style={styles.block}>
          <KV k="DOB" v={driver.date_of_birth || '—'} />
          <KV k="Phone" v={profile?.phone || '—'} action={() => Linking.openURL(`tel:${profile?.phone}`)} actionLabel="Call" />
          <KV k="State / LGA" v={`${driver.home_state || '—'} / ${driver.home_lga || '—'}`} />
          <KV k="Address" v={driver.home_address || '—'} />
        </View>

        <Text style={styles.sectionLabel}>EMERGENCY CONTACT</Text>
        <View style={styles.block}>
          <KV k="Name" v={driver.emergency_contact_name || '—'} />
          <KV k="Phone" v={driver.emergency_contact_phone || '—'} action={() => Linking.openURL(`tel:${driver.emergency_contact_phone}`)} actionLabel="Call" />
          <KV k="Relation" v={driver.emergency_contact_relation || '—'} />
        </View>

        <Text style={styles.sectionLabel}>DRIVER LICENSE</Text>
        <View style={styles.block}>
          <KV k="Number" v={driver.license_number || '—'} mono />
          <KV k="Class" v={driver.license_class || '—'} />
          <KV k="Expiry" v={driver.license_expiry || '—'} />
        </View>
        <Text style={styles.sectionLabel}>LICENSE DOCUMENTS</Text>
        <DocGrid
          items={[
            { label: 'License Front', url: signed['License Front'] },
            { label: 'License Back', url: signed['License Back'] },
            { label: 'NIN Slip', url: signed['NIN Slip'] },
          ]}
          onOpen={setDocModal}
        />

        <Text style={styles.sectionLabel}>VEHICLE</Text>
        <View style={styles.block}>
          {vehicle ? (
            <>
              <KV k="Plate" v={vehicle.plate_number || '—'} mono />
              <KV k="Type" v={vehicle.vehicle_type || '—'} />
              <KV k="Capacity" v={`${vehicle.capacity_tonnes ?? 0} t`} />
              <KV k="Chassis" v={vehicle.chassis_number || '—'} mono />
              <KV k="Insurance expiry" v={vehicle.insurance_expiry || '—'} />
            </>
          ) : <Text style={styles.hint}>No vehicle on file</Text>}
        </View>

        <Text style={styles.sectionLabel}>VEHICLE DOCUMENTS</Text>
        <DocGrid
          items={[
            { label: 'Vehicle Registration', url: signed['Vehicle Registration'] },
            { label: 'Insurance Certificate', url: signed['Insurance Certificate'] },
            { label: 'Road Worthiness', url: signed['Road Worthiness'] },
            { label: 'Vehicle Front Photo', url: signed['Vehicle Front Photo'] },
            { label: 'Vehicle Rear Photo', url: signed['Vehicle Rear Photo'] },
          ]}
          onOpen={setDocModal}
        />

        <Text style={styles.sectionLabel}>BANK</Text>
        <View style={styles.block}>
          <KV k="Bank" v={driver.bank_name || '—'} />
          <KV k="Account" v={driver.bank_account_number || '—'} mono />
          <KV k="Account name" v={driver.bank_account_name || '—'} />
        </View>

        <Text style={styles.sectionLabel}>CHECKLIST ({doneCount}/5)</Text>
        <View style={styles.block}>
          {CHECK_ITEMS.map(k => (
            <Pressable key={k} onPress={() => toggleCheck(k)} style={styles.checkRow}>
              <View style={[styles.cb, isDone(k) && styles.cbOn]}>{isDone(k) ? <Text style={styles.cm}>✓</Text> : null}</View>
              <Text style={styles.cbLabel}>{LABELS[k]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>ADMIN NOTES</Text>
        <TextInput value={notes} onChangeText={t => { setNotes(t); setNotesDirty(true); }} multiline placeholder="Internal notes" placeholderTextColor={palette.textDim} style={styles.notesInput} />
        {notesDirty ? <Pressable onPress={saveNotes} style={styles.saveBtn}><Text style={styles.saveTxt}>SAVE</Text></Pressable> : null}

        <Text style={styles.sectionLabel}>WITHDRAWALS</Text>
        {withdrawals.length === 0 ? <Text style={styles.hint}>None</Text> : withdrawals.map(w => {
          const color = w.status === 'completed' ? palette.neon : w.status === 'rejected' ? '#ff3b5c' : w.status === 'approved' ? '#3b82f6' : '#ffb300';
          return (
            <View key={w.id} style={styles.block}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.body}>₦{Number(w.amount_naira).toLocaleString()}</Text>
                <Text style={[styles.statusTxt, { color }]}>{w.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.hint}>{w.bank_name} · {w.bank_account_number}</Text>
              <Text style={styles.hint}>{new Date(w.created_at).toLocaleString()}</Text>
              {w.status === 'pending' ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable onPress={() => approveWd(w)} style={[styles.mini, { borderColor: palette.neon }]}><Text style={[styles.miniTxt, { color: palette.neon }]}>APPROVE</Text></Pressable>
                  <Pressable onPress={() => { setWdModal(w); setWdReason(''); }} style={[styles.mini, { borderColor: '#ff3b5c' }]}><Text style={[styles.miniTxt, { color: '#ff3b5c' }]}>REJECT</Text></Pressable>
                </View>
              ) : w.status === 'approved' ? (
                <Pressable onPress={() => completeWd(w)} style={[styles.mini, { borderColor: '#3b82f6', marginTop: 8 }]}><Text style={[styles.miniTxt, { color: '#3b82f6' }]}>MARK PAID</Text></Pressable>
              ) : null}
            </View>
          );
        })}

        <Text style={styles.sectionLabel}>RECENT TRIPS</Text>
        {trips.length === 0 ? <Text style={styles.hint}>None</Text> : trips.map(t => (
          <View key={t.id} style={styles.block}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.body}>{t.batches?.batch_code || '—'}</Text>
              <Text style={styles.hint}>{t.status}</Text>
            </View>
            <Text style={styles.hint}>{t.batches?.crop_name} · {t.quantity_kg}kg</Text>
          </View>
        ))}

        {driver.status !== 'active' ? (
          <>
            <Text style={styles.sectionLabel}>DECISION</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setDecision('rejected')} style={[styles.decBtn, { borderColor: '#ff3b5c' }]}><Text style={[styles.decTxt, { color: '#ff3b5c' }]}>REJECT</Text></Pressable>
              <Pressable onPress={() => setDecision('suspended')} style={[styles.decBtn, { borderColor: '#3b82f6' }]}><Text style={[styles.decTxt, { color: '#3b82f6' }]}>SUSPEND</Text></Pressable>
              <Pressable onPress={() => allDone ? setDecision('active') : Alert.alert('Checklist incomplete')} style={[styles.decBtn, { borderColor: palette.neon, backgroundColor: allDone ? palette.neon : 'transparent' }]}>
                <Text style={[styles.decTxt, { color: allDone ? '#000' : palette.neon }]}>APPROVE</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>SUSPEND DRIVER</Text>
            <Pressable onPress={() => setDecision('suspended')} style={[styles.decBtn, { borderColor: '#ff3b5c', flex: 1, maxWidth: 200 }]}>
              <Text style={[styles.decTxt, { color: '#ff3b5c' }]}>SUSPEND</Text>
            </Pressable>
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={!!docModal} transparent animationType="fade" onRequestClose={() => setDocModal(null)}>
        <View style={styles.modalBg}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60 }}>
            <Pressable onPress={() => setDocModal(null)}><Text style={{ fontSize: 24, color: '#fff' }}>✕</Text></Pressable>
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>{docModal?.label}</Text>
            <View style={{ width: 40 }} />
          </View>
          {docModal?.url ? <Image source={{ uri: docModal.url }} style={{ flex: 1, width: '100%' }} resizeMode="contain" /> : <Text style={{ color: '#fff', textAlign: 'center', marginTop: 40 }}>No document</Text>}
        </View>
      </Modal>

      <Modal visible={!!decision} transparent animationType="slide">
        <View style={styles.modalBgCenter}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{decision === 'active' ? 'Approve driver?' : decision === 'suspended' ? 'Suspend driver' : 'Reject application'}</Text>
            {decision !== 'active' ? (
              <>
                <Text style={styles.hint}>Reason:</Text>
                <TextInput value={reason} onChangeText={setReason} multiline placeholder="Reason…" placeholderTextColor={palette.textDim} style={styles.notesInput} />
              </>
            ) : <Text style={styles.hint}>Driver can go online and receive jobs.</Text>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable onPress={() => { setDecision(null); setReason(''); }} style={[styles.decBtn, { borderColor: palette.border }]}><Text style={[styles.decTxt, { color: palette.text }]}>CANCEL</Text></Pressable>
              <Pressable onPress={submitDecision} disabled={deciding} style={[styles.decBtn, { borderColor: decision === 'active' ? palette.neon : '#ff3b5c', backgroundColor: decision === 'active' ? palette.neon : 'transparent' }]}>
                {deciding ? <ActivityIndicator /> : <Text style={[styles.decTxt, { color: decision === 'active' ? '#000' : '#ff3b5c' }]}>CONFIRM</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!wdModal} transparent animationType="slide">
        <View style={styles.modalBgCenter}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject withdrawal</Text>
            <TextInput value={wdReason} onChangeText={setWdReason} multiline placeholder="Reason…" placeholderTextColor={palette.textDim} style={styles.notesInput} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable onPress={() => setWdModal(null)} style={[styles.decBtn, { borderColor: palette.border }]}><Text style={[styles.decTxt, { color: palette.text }]}>CANCEL</Text></Pressable>
              <Pressable onPress={rejectWd} style={[styles.decBtn, { borderColor: '#ff3b5c' }]}><Text style={[styles.decTxt, { color: '#ff3b5c' }]}>REJECT</Text></Pressable>
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
function KV({ k, v, mono, action, actionLabel }: any) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 5, alignItems: 'center' }}>
      <Text style={{ fontSize: 12, color: '#888', width: 110 }}>{k}</Text>
      <Text style={{ flex: 1, fontSize: 13, color: '#fff', fontFamily: mono ? 'monospace' : undefined }}>{v}</Text>
      {action ? <Pressable onPress={action} style={{ paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#00ff88', borderRadius: 6 }}><Text style={{ fontSize: 10, color: '#00ff88', fontWeight: '900' }}>{actionLabel}</Text></Pressable> : null}
    </View>
  );
}
function DocGrid({ items, onOpen }: any) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((d: any) => (
        <Pressable key={d.label} onPress={() => d.url && onOpen(d)} style={{ width: '30%', aspectRatio: 0.9, backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: d.url ? '#00ff88' : '#333', padding: 6, alignItems: 'center', justifyContent: 'center' }}>
          {d.url ? <Image source={{ uri: d.url }} style={{ width: '100%', height: '70%', borderRadius: 6 }} /> : <Text style={{ fontSize: 20 }}>—</Text>}
          <Text style={{ fontSize: 9, color: d.url ? '#fff' : '#666', textAlign: 'center', marginTop: 4, fontWeight: '700' }} numberOfLines={2}>{d.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 18, fontWeight: '900', color: '#ff3b5c' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: p.text, flex: 1 },
  meta: { fontSize: 12, color: p.textMuted, fontFamily: 'monospace', marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, borderWidth: 1.5 },
  statusTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 20, marginBottom: 8 },
  block: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  body: { fontSize: 14, color: p.text },
  hint: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  notesInput: { padding: 12, borderRadius: 10, backgroundColor: p.obsidian, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 13, minHeight: 70, textAlignVertical: 'top' },
  saveBtn: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: p.neon, borderRadius: 8 },
  saveTxt: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  cb: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  cbOn: { borderColor: p.neon, backgroundColor: p.neon },
  cm: { fontSize: 14, fontWeight: '900', color: '#000' },
  cbLabel: { flex: 1, fontSize: 13, color: p.text },
  mini: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  miniTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  decBtn: { flex: 1, paddingVertical: 14, borderWidth: 2, borderRadius: 10, alignItems: 'center' },
  decTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)' },
  modalBgCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: p.surface, padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: p.text, marginBottom: 12 },
});
