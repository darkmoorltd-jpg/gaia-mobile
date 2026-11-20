import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Modal, Image, Linking, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminFarmerDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const styles = createStyles(palette);

  const [farmer, setFarmer] = useState<any>(null);
  const [verification, setVerification] = useState<any>(null);
  const [docs, setDocs] = useState<{ label: string; url: string }[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editSection, setEditSection] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<any>({});
  const [editBusy, setEditBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin || !id) return;
    setBusy(true);
    try {
      const [{ data: fr }, { data: fv }] = await Promise.all([
        supabase.from('farmer_registry').select('*').eq('user_id', id).maybeSingle(),
        supabase.from('farmer_verifications').select('*').eq('user_id', id).maybeSingle(),
      ]);
      setFarmer(fr);
      setVerification(fv);

      const docsArr: { label: string; url: string }[] = [];
      if (fv?.id_image_url) docsArr.push({ label: 'Government ID', url: fv.id_image_url });
      if (fv?.selfie_url) docsArr.push({ label: 'Selfie with ID', url: fv.selfie_url });
      if (fr?.asset_photo_url) docsArr.push({ label: 'Farm photo', url: fr.asset_photo_url });
      if (fr?.farmer_portrait_url) docsArr.push({ label: 'Farmer portrait', url: fr.farmer_portrait_url });
      if (fr?.id_document_url) docsArr.push({ label: 'ID document', url: fr.id_document_url });
      setDocs(docsArr);
    } finally {
      setBusy(false);
    }
  }, [isAdmin, id]);

  const refresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openEdit = (section: string) => {
    const fields: any = {};
    if (section === 'identity') {
      fields.full_name = farmer?.full_name || '';
      fields.phone = farmer?.phone || '';
      fields.date_of_birth = farmer?.date_of_birth || '';
      fields.sex = farmer?.sex || '';
      fields.nin = farmer?.nin || '';
      fields.bvn = farmer?.bvn || '';
    } else if (section === 'location') {
      fields.state = farmer?.state || '';
      fields.lga = farmer?.lga || '';
      fields.ward = farmer?.ward || '';
      fields.community = farmer?.community || '';
      fields.gps_lat = String(farmer?.gps_lat || '');
      fields.gps_lon = String(farmer?.gps_lon || '');
    } else if (section === 'farm') {
      fields.primary_crops = farmer?.primary_crops || '';
      fields.farm_size_acres = String(farmer?.farm_size_acres || '');
      fields.land_area_hectares = String(farmer?.land_area_hectares || '');
    } else if (section === 'bank') {
      fields.bank_name = farmer?.bank_name || '';
      fields.bank_account_name = farmer?.bank_account_name || '';
      fields.bank_account_number = farmer?.bank_account_number || '';
    }
    setEditFields(fields);
    setEditSection(section);
  };

  const saveEdit = async () => {
    if (!editSection) return;
    setEditBusy(true);
    try {
      const updates: any = {};
      for (const [k, v] of Object.entries(editFields)) {
        if (v !== '' && v !== undefined && v !== null) updates[k] = v;
      }
      const { data, error } = await supabase.rpc('admin_edit_farmer', {
        p_farmer_id: id,
        p_updates: updates,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error('Edit failed');
      setEditSection(null);
      await load();
      Alert.alert('Saved', 'Farmer record updated.');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setEditBusy(false);
    }
  };

  const verifyNIN = (verified: boolean) => {
    Alert.alert(
      verified ? 'Verify NIN?' : 'Reject NIN?',
      verified ? 'Confirm that the NIN matches the ID document.' : 'Mark NIN as invalid or mismatched.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: verified ? 'VERIFY' : 'REJECT', style: verified ? 'default' : 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.rpc('admin_verify_farmer_nin', {
              p_farmer_id: id,
              p_verified: verified,
              p_note: verified ? null : 'Rejected by admin',
            });
            if (error) throw error;
            await load();
            Alert.alert(verified ? 'NIN Verified ✅' : 'NIN Rejected');
          } catch (e: any) { Alert.alert('Failed', e.message); }
        }},
      ],
    );
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedTxt}>Access denied</Text></View>;
  if (busy && !farmer) return <View style={styles.blocked}><ActivityIndicator color={palette.neon} /></View>;
  if (!farmer) return <View style={styles.blocked}><Text style={styles.blockedTxt}>Farmer not found</Text></View>;

  const age = farmer.date_of_birth
    ? Math.floor((Date.now() - new Date(farmer.date_of_birth).getTime()) / (365.25 * 86400000))
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.title} numberOfLines={1}>{farmer.full_name || 'Farmer'}</Text>
          {farmer.nin_verified ? <Text style={{ fontSize: 20 }}>✅</Text> : null}
        </View>
        <Text style={styles.sub}>
          {[farmer.state, farmer.lga, farmer.ward].filter(Boolean).join(' · ') || 'No location'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.neon} />}>

        {/* NIN verification banner */}
        <View style={[styles.verifBox, farmer.nin_verified && { borderColor: palette.neon, backgroundColor: 'rgba(0,255,136,0.06)' }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.verifTitle}>
              {farmer.nin_verified ? '✅ NIN Verified' : '⏳ NIN Pending Verification'}
            </Text>
            <Text style={styles.verifMeta}>NIN: {farmer.nin || 'not provided'}</Text>
          </View>
          {!farmer.nin_verified ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable onPress={() => verifyNIN(true)} style={[styles.smallBtn, { borderColor: palette.neon }]}>
                <Text style={[styles.smallBtnTxt, { color: palette.neon }]}>VERIFY</Text>
              </Pressable>
              <Pressable onPress={() => verifyNIN(false)} style={[styles.smallBtn, { borderColor: '#ff3b5c' }]}>
                <Text style={[styles.smallBtnTxt, { color: '#ff3b5c' }]}>REJECT</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Sections with edit buttons */}
        <Section
          title="IDENTITY" fields={[
            { k: 'Full name', v: farmer.full_name || '—' },
            { k: 'Phone', v: farmer.phone || '—' },
            { k: 'Date of birth', v: farmer.date_of_birth ? `${farmer.date_of_birth} (${age} yrs)` : '—' },
            { k: 'Sex', v: farmer.sex || '—' },
            { k: 'NIN', v: farmer.nin || '—', mono: true },
            { k: 'BVN', v: farmer.bvn || '—', mono: true },
          ]}
          onEdit={() => openEdit('identity')} styles={styles}
        />

        <Section
          title="LOCATION" fields={[
            { k: 'State', v: farmer.state || '—' },
            { k: 'LGA', v: farmer.lga || '—' },
            { k: 'Ward', v: farmer.ward || '—' },
            { k: 'Community', v: farmer.community || '—' },
            { k: 'GPS', v: farmer.gps_lat ? `${farmer.gps_lat}, ${farmer.gps_lon}` : '—', mono: true,
              action: farmer.gps_lat ? () => Linking.openURL(`https://maps.google.com/?q=${farmer.gps_lat},${farmer.gps_lon}`) : undefined, actionLabel: 'Map' },
          ]}
          onEdit={() => openEdit('location')} styles={styles}
        />

        <Section
          title="FARM" fields={[
            { k: 'Primary crops', v: farmer.primary_crops || '—' },
            { k: 'Size (acres)', v: String(farmer.farm_size_acres || '—') },
            { k: 'Size (hectares)', v: String(farmer.land_area_hectares || '—') },
          ]}
          onEdit={() => openEdit('farm')} styles={styles}
        />

        <Section
          title="BANK" fields={[
            { k: 'Bank', v: farmer.bank_name || '—' },
            { k: 'Account name', v: farmer.bank_account_name || '—' },
            { k: 'Account #', v: farmer.bank_account_number || '—', mono: true },
          ]}
          onEdit={() => openEdit('bank')} styles={styles}
        />

        <Text style={styles.sectionLbl}>REGISTERED BY AGENT</Text>
        <View style={styles.block}>
          <KV k="Agent user ID" v={farmer.registered_by_agent || '—'} mono />
          <KV k="Registered" v={farmer.created_at ? new Date(farmer.created_at).toLocaleString() : '—'} />
        </View>

        {docs.length > 0 ? (
          <>
            <Text style={styles.sectionLbl}>DOCUMENTS ({docs.length})</Text>
            {docs.map((d, i) => (
              <Pressable key={i} onPress={() => Linking.openURL(d.url)} style={styles.docRow}>
                <Text style={styles.docLabel}>📎 {d.label}</Text>
                <Text style={styles.docOpen}>OPEN →</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {farmer.farm_assets && Array.isArray(farmer.farm_assets) && farmer.farm_assets.length > 0 ? (
          <>
            <Text style={styles.sectionLbl}>ASSETS</Text>
            <View style={styles.block}>
              <Text style={styles.body}>{farmer.farm_assets.join(', ')}</Text>
            </View>
          </>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={!!editSection} transparent animationType="slide" onRequestClose={() => setEditSection(null)}>
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Pressable onPress={() => setEditSection(null)}><Text style={styles.back}>CANCEL</Text></Pressable>
            <Text style={styles.title}>Edit {editSection}</Text>

            {Object.entries(editFields).map(([k, v]) => (
              <View key={k}>
                <Text style={styles.label}>{k.replace(/_/g, ' ').toUpperCase()}</Text>
                <TextInput
                  value={String(v ?? '')}
                  onChangeText={(text) => setEditFields((prev: any) => ({ ...prev, [k]: text }))}
                  style={styles.input}
                  placeholderTextColor={palette.textDim}
                  autoCapitalize="none"
                />
              </View>
            ))}

            <Pressable onPress={saveEdit} disabled={editBusy} style={[styles.cta, editBusy && { opacity: 0.5 }]}>
              {editBusy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>SAVE CHANGES</Text>}
            </Pressable>
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Section({ title, fields, onEdit, styles }: any) {
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
        <Text style={styles.sectionLbl}>{title}</Text>
        <Pressable onPress={onEdit} style={styles.editBtn}><Text style={styles.editTxt}>EDIT</Text></Pressable>
      </View>
      <View style={styles.block}>
        {fields.map((f: any, i: number) => (
          <KV key={i} {...f} />
        ))}
      </View>
    </>
  );
}

function KV({ k, v, mono, action, actionLabel }: any) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 6, alignItems: 'center' }}>
      <Text style={{ fontSize: 12, color: '#888', width: 120 }}>{k}</Text>
      <Text style={{ flex: 1, fontSize: 13, color: '#fff', fontFamily: mono ? 'monospace' : undefined }}>{v}</Text>
      {action ? <Pressable onPress={action} style={{ paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#00ff88', borderRadius: 6 }}><Text style={{ fontSize: 10, color: '#00ff88', fontWeight: '900' }}>{actionLabel}</Text></Pressable> : null}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedTxt: { fontSize: 18, fontWeight: '900', color: '#ff3b5c' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: p.text, flex: 1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  verifBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#ffb300', backgroundColor: 'rgba(255,179,0,0.06)', marginTop: 12 },
  verifTitle: { fontSize: 14, fontWeight: '900', color: p.text },
  verifMeta: { fontSize: 11, color: p.textMuted, marginTop: 4, fontFamily: 'monospace' },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5 },
  smallBtnTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  sectionLbl: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 20, marginBottom: 8 },
  block: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  body: { fontSize: 13, color: p.text },
  editBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(0,255,136,0.12)', borderWidth: 1, borderColor: p.neon },
  editTxt: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  docLabel: { fontSize: 13, color: p.text },
  docOpen: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  modalSheet: { backgroundColor: p.obsidian, padding: 20, paddingTop: 60, flex: 1 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 14, marginBottom: 6, letterSpacing: 1 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 15 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
