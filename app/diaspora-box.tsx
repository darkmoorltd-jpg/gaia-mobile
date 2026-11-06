import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const TIERS = [
  { id: 'small', name: 'Small Box', price: 25, contents: '5kg seasonal produce · monthly delivery' },
  { id: 'family', name: 'Family Box', price: 60, contents: '20kg produce + quarterly farm photos' },
  { id: 'premium', name: 'Premium Box', price: 120, contents: 'Weekly delivery + live video calls with farmer' },
];

export default function DiasporaBox() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [subs, setSubs] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [tier, setTier] = useState(TIERS[1]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from('diaspora_subscriptions').select('*').eq('buyer_id', user.id).order('created_at', { ascending: false });
    setSubs(data || []);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subscribe = async () => {
    if (!user) { Alert.alert('Please log in'); return; }
    if (!name.trim() || !phone.trim() || !address.trim()) { Alert.alert('Fill all fields'); return; }
    setSaving(true);
    const { error } = await supabase.from('diaspora_subscriptions').insert({
      buyer_id: user.id,
      recipient_name: name.trim(),
      recipient_phone: phone.trim(),
      recipient_address: address.trim(),
      tier: tier.id,
      amount_monthly: tier.price,
      next_delivery_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'active',
    });
    setSaving(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Subscribed!', `You'll be charged $${tier.price} monthly. First delivery in 7 days.`);
    setShowNew(false); setName(''); setPhone(''); setAddress('');
    load();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>✈️ Diaspora Box</Text>
        <Text style={styles.sub}>Send fresh organic food to family in Nigeria — delivered monthly.</Text>

        <View style={styles.banner}>
          <Text style={styles.bannerTxt}>🇳🇬 Pay in USD · Delivered in Nigeria</Text>
        </View>

        <Pressable onPress={() => setShowNew(true)} style={styles.cta}>
          <Text style={styles.ctaText}>+ NEW SUBSCRIPTION</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>MY SUBSCRIPTIONS</Text>
        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {!busy && subs.length === 0 ? <Text style={styles.empty}>No subscriptions yet.</Text> : null}
        {subs.map(s => (
          <View key={s.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subTier}>{s.tier.toUpperCase()} BOX · ${s.amount_monthly}/mo</Text>
              <Text style={styles.subRecipient}>👤 {s.recipient_name}</Text>
              <Text style={styles.subAddr}>📍 {s.recipient_address}</Text>
              <Text style={[styles.subStatus, { color: s.status === 'active' ? palette.neon : '#ffb300' }]}>
                {s.status.toUpperCase()} · Next: {s.next_delivery_date || '—'}
              </Text>
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={showNew} animationType="slide" transparent onRequestClose={() => setShowNew(false)}>
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Text style={styles.title}>New Subscription</Text>

            <Text style={styles.label}>CHOOSE BOX</Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {TIERS.map(t => (
                <Pressable key={t.id} onPress={() => setTier(t)} style={[styles.tierCard, tier.id === t.id && styles.tierCardOn]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierName}>{t.name}</Text>
                    <Text style={styles.tierContents}>{t.contents}</Text>
                  </View>
                  <Text style={styles.tierPrice}>${t.price}/mo</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>RECIPIENT NAME</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={palette.textDim} placeholder="e.g. Mama Ngozi" />

            <Text style={styles.label}>RECIPIENT PHONE</Text>
            <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={palette.textDim} placeholder="080..." />

            <Text style={styles.label}>DELIVERY ADDRESS IN NIGERIA</Text>
            <TextInput value={address} onChangeText={setAddress} multiline style={[styles.input, { minHeight: 70 }]} placeholderTextColor={palette.textDim} />

            <Pressable onPress={subscribe} disabled={saving} style={styles.cta}>
              {saving ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>SUBSCRIBE ${tier.price}/MO</Text>}
            </Pressable>
            <Pressable onPress={() => setShowNew(false)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted }}>Cancel</Text>
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
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  banner: { backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', padding: 12, borderRadius: 12, marginBottom: 16 },
  bannerTxt: { fontSize: 12, fontWeight: '800', color: '#ffd700', textAlign: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 20, marginBottom: 10 },
  empty: { fontSize: 13, color: p.textMuted, marginTop: 20 },
  card: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  subTier: { fontSize: 13, fontWeight: '900', color: p.neon },
  subRecipient: { fontSize: 13, color: p.text, marginTop: 6 },
  subAddr: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  subStatus: { fontSize: 11, fontWeight: '800', marginTop: 8 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginTop: 8 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  modalSheet: { backgroundColor: p.abyss, marginTop: 60, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  tierCard: { flexDirection: 'row', padding: 14, borderRadius: 12, borderWidth: 2, borderColor: p.border, alignItems: 'center' },
  tierCardOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.1)' },
  tierName: { fontSize: 14, fontWeight: '900', color: p.text },
  tierContents: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  tierPrice: { fontSize: 16, fontWeight: '900', color: p.neon },
});
