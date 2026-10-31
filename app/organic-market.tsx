import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function OrganicMarket() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [listings, setListings] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [giftItem, setGiftItem] = useState<any | null>(null);
  const [giftName, setGiftName] = useState('');
  const [giftPhone, setGiftPhone] = useState('');
  const [giftAddress, setGiftAddress] = useState('');
  const [gifting, setGifting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('marketplace_listings')
        .select('*')
        .eq('is_organic', true)
        .order('created_at', { ascending: false });
      setListings(data || []);
      setBusy(false);
    })();
  }, []);

  const processGift = async () => {
    if (!giftName || !giftPhone || !giftAddress) {
      Alert.alert('Missing Info', 'Please fill in the recipient details.');
      return;
    }
    setGifting(true);
    
    const { error } = await supabase.from('diaspora_orders').insert({
      buyer_id: user.id,
      recipient_name: giftName,
      recipient_phone: giftPhone,
      recipient_address: giftAddress,
      listing_id: giftItem.id,
      amount_paid: giftItem.price,
      status: 'paid'
    });

    if (error) Alert.alert('Payment Failed', error.message);
    else {
      Alert.alert('Gift Sent!', `GAIA will deliver ${giftItem.title} to ${giftName} within 3 days.`);
      setGiftItem(null);
      setGiftName(''); setGiftPhone(''); setGiftAddress('');
    }
    setGifting(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>🌿 GAIA Organic</Text>
          <Text style={styles.heroSub}>Certified chemical-free food, delivered to your family.</Text>
        </View>

        <View style={styles.diasporaBanner}>
          <Text style={styles.diasporaTitle}>✈️ Shopping from abroad?</Text>
          <Text style={styles.diasporaSub}>You can pay here, and we deliver fresh organic food directly to your parents in Nigeria.</Text>
        </View>

        <Text style={styles.sectionLabel}>FRESH ARRIVALS</Text>
        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {listings.map(item => (
          <View key={item.id} style={styles.card}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=400' }} style={styles.img} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemPrice}>₦{Number(item.price).toLocaleString()} <Text style={styles.unit}>/ {item.unit}</Text></Text>
              <Text style={styles.itemLoc}>📍 {item.location}</Text>
              
              <View style={styles.btnRow}>
                <Pressable onPress={() => setGiftItem(item)} style={styles.giftBtn}>
                  <Text style={styles.giftBtnTxt}>🎁 SEND AS GIFT</Text>
                </Pressable>
                <Pressable style={styles.buyBtn}>
                  <Text style={styles.buyBtnTxt}>BUY</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* GIFT MODAL */}
      <Modal visible={!!giftItem} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Send as Gift</Text>
            <Text style={styles.modalSub}>Ordering {giftItem?.title} for a loved one.</Text>

            <Text style={styles.label}>RECIPIENT NAME</Text>
            <TextInput value={giftName} onChangeText={setGiftName} placeholder="e.g. Mama Ngozi" placeholderTextColor="#888" style={styles.input} />

            <Text style={styles.label}>RECIPIENT PHONE</Text>
            <TextInput value={giftPhone} onChangeText={setGiftPhone} keyboardType="phone-pad" placeholder="080..." placeholderTextColor="#888" style={styles.input} />

            <Text style={styles.label}>DELIVERY ADDRESS</Text>
            <TextInput value={giftAddress} onChangeText={setGiftAddress} multiline style={[styles.input, { height: 80 }]} placeholder="Full address in Nigeria" placeholderTextColor="#888" />

            <Pressable onPress={processGift} disabled={gifting} style={styles.payBtn}>
              {gifting ? <ActivityIndicator color="#000" /> : <Text style={styles.payBtnTxt}>PAY ₦{Number(giftItem?.price).toLocaleString()} (CARD/APPLE PAY)</Text>}
            </Pressable>
            <Pressable onPress={() => setGiftItem(null)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted }}>Cancel</Text>
            </Pressable>
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
  hero: { marginBottom: 24, alignItems: 'center' },
  heroTitle: { fontSize: 32, fontWeight: '900', color: '#ffd700', letterSpacing: -1 },
  heroSub: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 8 },
  diasporaBanner: { backgroundColor: 'rgba(255,215,0,0.1)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', marginBottom: 24 },
  diasporaTitle: { color: '#ffd700', fontSize: 14, fontWeight: '900' },
  diasporaSub: { color: p.text, fontSize: 12, marginTop: 4, lineHeight: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 2, marginBottom: 12 },
  card: { flexDirection: 'row', backgroundColor: p.surface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 12, gap: 12 },
  img: { width: 100, height: 100, borderRadius: 12 },
  itemTitle: { fontSize: 16, fontWeight: '800', color: p.text },
  itemPrice: { fontSize: 16, fontWeight: '900', color: '#ffd700', marginTop: 4 },
  unit: { fontSize: 11, color: p.textMuted, fontWeight: '400' },
  itemLoc: { fontSize: 11, color: p.textMuted, marginTop: 4, marginBottom: 8 },
  btnRow: { flexDirection: 'row', gap: 8 },
  giftBtn: { flex: 2, backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1, borderColor: '#ffd700', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  giftBtnTxt: { fontSize: 10, fontWeight: '900', color: '#ffd700' },
  buyBtn: { flex: 1, backgroundColor: p.neon, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  buyBtnTxt: { fontSize: 10, fontWeight: '900', color: '#000' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: p.abyss, padding: 24, borderRadius: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#ffd700' },
  modalSub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: p.surface, padding: 16, borderRadius: 12, color: p.text, borderWidth: 1, borderColor: p.border },
  payBtn: { backgroundColor: '#ffd700', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  payBtnTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
