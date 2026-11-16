import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Modal, Image, Linking } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const CHECK_ITEMS = ['license_verified', 'vehicle_verified', 'bank_verified'] as const;
const LABELS: Record<string, string> = {
  license_verified: 'License photo matches license number',
  vehicle_verified: 'Vehicle plate + capacity match',
  bank_verified: 'Bank account name matches driver',
};

export default function AdminDriverDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [driver, setDriver] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [licenseUrl, setLicenseUrl] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [decision, setDecision] = useState<null | 'active' | 'suspended'>(null);
  const [reason, setReason] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [wdModal, setWdModal] = useState<any>(null);
  const [wdReason, setWdReason] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin || !id) return;
    setBusy(true);
    try {
      const [{ data: drv }, { data: veh }, { data: wds }, { data: tps }] = await Promise.all([
        supabase.from('driver_profiles').select('*').eq('user_id', id).maybeSingle(),
        supabase.from('vehicles').select('*').eq('driver_id', id).maybeSingle(),
        supabase.from('driver_withdrawals').select('*').eq('driver_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('batch_movements').select('id, status, quantity_kg, delivery_fee, created_at, batches(batch_code, crop_name)').eq('driver_id', id).order('created_at', { ascending: false }).limit(10),
      ]);
      setDriver(drv); setVehicle(veh);
      setWithdrawals(wds || []); setTrips(tps || []);
      if (drv?.admin_notes) setNotes(drv.admin_notes);
      setNotesDirty(false);
      if (drv?.license_url) {
        const path = String(drv.license_url).split('/').pop();
        const { data: s } = await supabase.storage.from('driver-docs').createSignedUrl(path!, 60 * 60 * 24);
        setLicenseUrl(s?.signedUrl || drv.license_url);
      } else setLicenseUrl(null);
    } finally { setBusy(false); }
  }, [isAdmin, id]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const checklist = driver?.checklist || {};
  const isDone = (k: string) => checklist[k]?.done === true;
  const allDone = CHECK_ITEMS.every(isDone);

  const toggleCheck = async (key: string) => {
    if (!driver) return;
    const next = { ...checklist };
    if (next[key]?.done) delete next[key];
    else next[key] = { done: true, by: user?.id, at: new Date().toISOString() };
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
    if (decision === 'suspended' && reason.trim().length < 3) return Alert.alert('Reason required');
    if (decision === 'active' && !allDone) return Alert.alert('Checklist incomplete');
    setDeciding(true);
    try {
      await supabase.from('driver_profiles').update({
        status: decision, reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
        rejection_reason: decision === 'suspended' ? reason.trim() : null,
      }).eq('user_id', driver.user_id);
      setDecision(null); setReason('');
      await load();
      Alert.alert('Updated');
    } catch (e: any) { Alert.alert('Failed', e.message); }
    finally { setDeciding(false); }
  };

  const approveWd = async (wd: any) => {
    try { await supabase.rpc('admin_approve_withdrawal', { p_id: wd.id }); await load(); }
    catch (e: any) { Alert.alert('Failed', e.message); }
  };
  const completeWd = async (wd: any) => {
    try { await supabase.rpc('admin_complete_withdrawal', { p_id: wd.id }); await load(); }
    catch (e: any) { Alert.alert('Failed', e.message); }
  };
  const rejectWd = async () => {
    if (!wdModal || wdReason.trim().length < 3) return Alert.alert('Reason required');
    try {
      await supabase.rpc('admin_reject_withdrawal', { p_id: wdModal.id, p_reason: wdReason.trim() });
      setWdModal(null); setWdReason(''); await load();
    } catch (e: any) { Alert.alert('Failed', e.message); }
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  if (busy && !driver) return <View style={styles.blocked}><ActivityIndicator color={palette.neon} /></View>;
  if (!driver) return <View style={styles.blocked}><Text style={styles.blockedText}>Not found</Text></View>;

  const statusColor = driver.status === 'active' ? palette.neon : driver.status === 'pending' ? '#ffb300' : '#ff3b5c';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Driver Detail</Text>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusTxt, { color: statusColor }]}>{String(driver.status).toUpperCase()}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionLabel}>LICENSE</Text>
        <View style={styles.block}>
          <KV k="License #" v={driver.license_number || '—'} mono />
          {licenseUrl ? (
            <Pressable onPress={() => Linking.openURL(licenseUrl)}>
              <Image source={{ uri: licenseUrl }} style={{ width: '100%', height: 180, borderRadius: 10, marginTop: 8 }} />
            </Pressable>
          ) : <Text style={styles.hint}>No license image</Text>}
        </View>
        <Text style={styles.sectionLabel}>VEHICLE</Text>
        <View style={styles.block}>
          {vehicle ? (
            <>
              <KV k="Plate" v={vehicle.plate_number || '—'} mono />
              <KV k="Type" v={vehicle.vehicle_type || '—'} />
              <KV k="Capacity" v={`${vehicle.capacity_tonnes ?? 0} tonnes`} />
            </>
          ) : <Text style={styles.hint}>No vehicle</Text>}
        </View>
        <Text style={styles.sectionLabel}>BANK</Text>
        <View style={styles.block}>
          <KV k="Bank" v={driver.bank_name || '—'} />
          <KV k="Account" v={driver.bank_account_number || '—'} mono />
          <KV k="Name" v={driver.bank_account_name || '—'} />
        </View>
        <Text style={styles.sectionLabel}>CHECKLIST</Text>
        <View style={styles.block}>
          {CHECK_ITEMS.map(k => (
            <Pressable key={k} onPress={() => toggleCheck(k)} style={styles.checkRow}>
              <View style={[styles.checkbox, isDone(k) && styles.checkboxOn]}>
                {isDone(k) ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkLabel}>{LABELS[k]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sectionLabel}>ADMIN NOTES</Text>
        <TextInput value={notes} onChangeText={t => { setNotes(t); setNotesDirty(true); }} multiline placeholder="Internal notes" placeholderTextColor={palette.textDim} style={styles.notesInput} />
        {notesDirty ? <Pressable onPress={saveNotes} style={styles.saveNotesBtn}><Text style={styles.saveNotesTxt}>SAVE</Text></Pressable> : null}

        <Text style={styles.sectionLabel}>WITHDRAWALS</Text>
        {withdrawals.length === 0 ? <Text style={styles.hint}>None</Text> : withdrawals.map(w => (
          <View key={w.id} style={styles.block}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.body}>₦{Number(w.amount_naira).toLocaleString()}</Text>
              <Text style={[styles.statusTxt, { color: w.status === 'completed' ? palette.neon : w.status === 'rejected' ? '#ff3b5c' : w.status === 'approved' ? '#3b82f6' : '#ffb300' }]}>{w.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.hint}>{w.bank_name} · {w.bank_account_number}</Text>
            <Text style={styles.hint}>{new Date(w.created_at).toLocaleString()}</Text>
            {w.status === 'pending' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable onPress={() => approveWd(w)} style={[styles.miniBtn, { borderColor: palette.neon }]}><Text style={[styles.miniBtnTxt, { color: palette.neon }]}>APPROVE</Text></Pressable>
                <Pressable onPress={() => { setWdModal(w); setWdReason(''); }} style={[styles.miniBtn, { borderColor: '#ff3b5c' }]}><Text style={[styles.miniBtnTxt, { color: '#ff3b5c' }]}>REJECT</Text></Pressable>
              </View>
            ) : w.status === 'approved' ? (
              <Pressable onPress={() => completeWd(w)} style={[styles.miniBtn, { borderColor: '#3b82f6', marginTop: 8 }]}><Text style={[styles.miniBtnTxt, { color: '#3b82f6' }]}>MARK PAID</Text></Pressable>
            ) : null}
          </View>
        ))}

        <Text style={styles.sectionLabel}>RECENT TRIPS</Text>
        {trips.length === 0 ? <Text style={styles.hint}>None</Text> : trips.map(t => (
          <View key={t.id} style={styles.block}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.body}>{t.batches?.batch_code || '—'}</Text>
              <Text style={styles.hint}>{t.status}</Text>
            </View>
          </View>
        ))}

        {driver.status !== 'active' ? (
          <>
            <Text style={styles.sectionLabel}>DECISION</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setDecision('suspended')} style={[styles.decBtn, { borderColor: '#ff3b5c' }]}><Text style={[styles.decTxt, { color: '#ff3b5c' }]}>SUSPEND</Text></Pressable>
              <Pressable onPress={() => allDone ? setDecision('active') : Alert.alert('Checklist incomplete')} style={[styles.decBtn, { borderColor: palette.neon, backgroundColor: allDone ? palette.neon : 'transparent' }]}>
                <Text style={[styles.decTxt, { color: allDone ? '#000' : palette.neon }]}>APPROVE</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={!!decision} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{decision === 'active' ? 'Approve driver?' : 'Suspend driver'}</Text>
            {decision === 'suspended' ? (
              <>
                <Text style={styles.hint}>Reason:</Text>
                <TextInput value={reason} onChangeText={setReason} multiline placeholder="Reason…" placeholderTextColor={palette.textDim} style={styles.notesInput} />
              </>
            ) : <Text style={styles.hint}>Driver will be able to go online.</Text>}
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
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject withdrawal</Text>
            <TextInput value={wdReason} onChangeText={setWdReason} multiline placeholder="Reason for driver…" placeholderTextColor={palette.textDim} style={styles.notesInput} />
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

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 5 }}>
      <Text style={{ fontSize: 12, color: '#888', width: 100 }}>{k}</Text>
      <Text style={{ flex: 1, fontSize: 13, color: '#fff', fontFamily: mono ? 'monospace' : undefined }}>{v}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 18, fontWeight: '900', color: '#ff3b5c' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '900', color: p.text },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, borderWidth: 1.5, marginTop: 8 },
  statusTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 20, marginBottom: 8 },
  block: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  body: { fontSize: 14, color: p.text },
  hint: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  notesInput: { padding: 12, borderRadius: 10, backgroundColor: p.obsidian, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 13, minHeight: 70, textAlignVertical: 'top' },
  saveNotesBtn: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: p.neon, borderRadius: 8 },
  saveNotesTxt: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { borderColor: p.neon, backgroundColor: p.neon },
  checkMark: { fontSize: 14, fontWeight: '900', color: '#000' },
  checkLabel: { flex: 1, fontSize: 13, color: p.text },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  miniBtnTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  decBtn: { flex: 1, paddingVertical: 14, borderWidth: 2, borderRadius: 10, alignItems: 'center' },
  decTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: p.surface, padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: p.text, marginBottom: 12 },
});