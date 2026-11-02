import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, ActivityIndicator, Linking, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function AdminKYCQueue() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === 'darkmoorltd@gmail.com';

  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_get_pending_kyc');
    if (!error) setRows(data || []);
    setBusy(false);
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAction = async (verification_id: string, status: 'approved' | 'rejected', user_id: string) => {
    setActing(true);
    const { error } = await supabase.from('farmer_verifications').update({ status }).eq('id', verification_id);
    
    if (!error) {
      await supabase.from('user_profiles').update({ verification_status: status }).eq('user_id', user_id);
      Alert.alert('Success', `Verification ${status}.`);
      setSelected(null);
      load();
    } else {
      Alert.alert('Error', error.message);
    }
    setActing(false);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access Denied</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>KYC Queue</Text>
        <Text style={styles.sub}>{rows.length} pending verifications</Text>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {rows.map(r => (
          <Pressable key={r.verification_id} onPress={() => setSelected(r)} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.full_name || 'Unknown'}</Text>
              <Text style={styles.meta}>{r.email}</Text>
              <Text style={styles.meta}>{r.state} · {r.lga}</Text>
              <View style={styles.badge}><Text style={styles.badgeTxt}>NDFR DATA INCLUDED</Text></View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* DETAIL MODAL */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
              
              <Text style={styles.title}>{selected?.full_name}</Text>
              <Text style={styles.sub}>{selected?.email} · {selected?.phone}</Text>

              <Text style={styles.sectionLabel}>IDENTITY DOCUMENTS</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {selected?.id_image_url ? (
                  <Pressable onPress={() => Linking.openURL(selected.id_image_url)} style={{ flex: 1 }}>
                    <Text style={styles.imgLbl}>ID CARD</Text>
                    <Image source={{ uri: selected.id_image_url }} style={styles.img} />
                  </Pressable>
                ) : null}
                {selected?.selfie_url ? (
                  <Pressable onPress={() => Linking.openURL(selected.selfie_url)} style={{ flex: 1 }}>
                    <Text style={styles.imgLbl}>SELFIE</Text>
                    <Image source={{ uri: selected.selfie_url }} style={styles.img} />
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.sectionLabel}>NDFR REGISTRY DATA</Text>
              <Text style={styles.kv}><Text style={styles.k}>Category: </Text>{selected?.farmer_category} ({selected?.farmer_subcategory})</Text>
              <Text style={styles.kv}><Text style={styles.k}>Land: </Text>{selected?.land_tenure} · {selected?.farm_size_acres} acres</Text>
              <Text style={styles.kv}><Text style={styles.k}>Household: </Text>{selected?.household_size} people</Text>
              <Text style={styles.kv}><Text style={styles.k}>Literacy: </Text>Level {selected?.literacy_level}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Education: </Text>Level {selected?.education_level}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Assets: </Text>{selected?.farm_assets?.join(', ') || 'None'}</Text>
              <Text style={styles.kv}><Text style={styles.k}>Registered by Agent: </Text>{selected?.registered_by_agent ? 'Yes' : 'Self'}</Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
                <Pressable disabled={acting} onPress={() => handleAction(selected.verification_id, 'approved', selected.user_id)} style={[styles.btn, { backgroundColor: palette.neon }]}>
                  <Text style={[styles.btnTxt, { color: '#000' }]}>APPROVE</Text>
                </Pressable>
                <Pressable disabled={acting} onPress={() => handleAction(selected.verification_id, 'rejected', selected.user_id)} style={[styles.btn, { backgroundColor: 'transparent', borderColor: '#ff3b5c', borderWidth: 2 }]}>
                  <Text style={[styles.btnTxt, { color: '#ff3b5c' }]}>REJECT</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  name: { fontSize: 16, fontWeight: '900', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  badge: { backgroundColor: 'rgba(0,255,136,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 6 },
  badgeTxt: { fontSize: 8, fontWeight: '900', color: p.neon, letterSpacing: 0.5 },
  chevron: { fontSize: 22, color: p.textDim },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '94%' },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1.5, marginTop: 20, marginBottom: 8 },
  kv: { fontSize: 13, color: p.text, marginBottom: 6 },
  k: { color: p.textMuted, fontWeight: '700' },
  imgLbl: { fontSize: 9, fontWeight: '900', color: p.textMuted, marginBottom: 4 },
  img: { width: '100%', height: 180, borderRadius: 10, backgroundColor: p.surface },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnTxt: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
});
