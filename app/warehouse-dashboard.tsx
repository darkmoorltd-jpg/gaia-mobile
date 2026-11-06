import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal, Switch } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function WarehouseDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [company, setCompany] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [uName, setUName] = useState('');
  const [uType, setUType] = useState('dry');
  const [uState, setUState] = useState('Lagos');
  const [uLga, setULga] = useState('');
  const [uAddress, setUAddress] = useState('');
  const [uCapacity, setUCapacity] = useState('');
  const [uRate, setURate] = useState('');
  const [uMinDays, setUMinDays] = useState('7');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: co } = await supabase.from('warehouse_companies').select('*').eq('owner_id', user.id).maybeSingle();
    setCompany(co);
    if (co) {
      const { data: us } = await supabase.from('warehouse_units').select('*').eq('company_id', co.id).order('created_at', { ascending: false });
      setUnits(us || []);
      const { data: bs } = await supabase.from('warehouse_bookings')
        .select('*, warehouse_units(unit_name)')
        .in('unit_id', (us || []).map((u: any) => u.id))
        .order('created_at', { ascending: false });
      setBookings(bs || []);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addUnit = async () => {
    if (!uName.trim() || !uCapacity || !uRate) { Alert.alert('Missing fields'); return; }
    setAdding(true);
    const { error } = await supabase.rpc('add_warehouse_unit', {
      p_unit_name: uName.trim(),
      p_unit_type: uType,
      p_state: uState,
      p_lga: uLga.trim() || null,
      p_address: uAddress.trim() || null,
      p_capacity_tonnes: parseFloat(uCapacity),
      p_daily_rate: parseFloat(uRate),
      p_min_days: parseInt(uMinDays) || 7,
      p_features: [],
      p_photos: [],
    });
    setAdding(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Unit Added', 'Now pay listing fee to make it visible to farmers.');
    setShowAdd(false);
    setUName(''); setUCapacity(''); setURate(''); setUAddress(''); setULga('');
    load();
  };

  const toggleListing = async (unit: any) => {
    if (unit.is_listed) {
      Alert.alert('Unlist unit?', 'Farmers will no longer see this unit.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unlist', style: 'destructive', onPress: async () => {
          await supabase.from('warehouse_units').update({ is_listed: false }).eq('id', unit.id);
          load();
        }},
      ]);
    } else {
      Alert.alert('Pay listing fee?', '₦10,000 for 1 month. Unit will go live immediately.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay Now', onPress: async () => {
          const ref = 'GAIA_LIST_' + Date.now().toString(36).toUpperCase();
          const { error } = await supabase.rpc('pay_listing_fee', {
            p_unit_id: unit.id, p_payment_ref: ref, p_months: 1
          });
          if (error) { Alert.alert('Failed', error.message); return; }
          Alert.alert('Listed!', 'Your unit is now visible to farmers.');
          load();
        }},
      ]);
    }
  };

  const respondBooking = async (booking: any, action: 'accept' | 'reject') => {
    const { error } = await supabase.rpc('respond_to_booking', {
      p_booking_id: booking.id, p_action: action
    });
    if (error) { Alert.alert('Failed', error.message); return; }
    load();
  };

  if (loading) return <View style={styles.container}><ActivityIndicator color={palette.neon} style={{ marginTop: 100 }} /></View>;

  if (!company) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Warehouse Dashboard</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>You haven't registered a warehouse company yet.</Text>
            <Pressable onPress={() => router.push('/warehouse-register' as any)} style={styles.cta}>
              <Text style={styles.ctaText}>REGISTER COMPANY</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const listedCount = units.filter(u => u.is_listed).length;
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const totalEarned = bookings.filter(b => b.payment_status === 'paid').reduce((s, b) => s + Number(b.company_payout), 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>{company.company_name}</Text>
        <Text style={styles.sub}>{company.verification_status.toUpperCase()} · {listedCount} of {units.length} units listed</Text>

        <View style={styles.statRow}>
          <View style={styles.stat}><Text style={styles.statVal}>{units.length}</Text><Text style={styles.statLbl}>UNITS</Text></View>
          <View style={styles.stat}><Text style={styles.statVal}>{pendingBookings.length}</Text><Text style={styles.statLbl}>PENDING</Text></View>
          <View style={styles.stat}><Text style={styles.statVal}>₦{totalEarned.toLocaleString()}</Text><Text style={styles.statLbl}>EARNED</Text></View>
        </View>

        <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ ADD NEW UNIT</Text>
        </Pressable>

        {pendingBookings.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>PENDING BOOKINGS</Text>
            {pendingBookings.map(b => (
              <View key={b.id} style={styles.bookingCard}>
                <Text style={styles.bookingUnit}>{b.warehouse_units?.unit_name || 'Unit'}</Text>
                <Text style={styles.bookingMeta}>{b.tonnes}t · {b.start_date} → {b.end_date}</Text>
                <Text style={styles.bookingAmount}>₦{Number(b.total_cost).toLocaleString()} (you get ₦{Number(b.company_payout).toLocaleString()})</Text>
                {b.farmer_notes ? <Text style={styles.bookingNotes}>"{b.farmer_notes}"</Text> : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Pressable onPress={() => respondBooking(b, 'accept')} style={[styles.smallBtn, { borderColor: palette.neon, flex: 1 }]}>
                    <Text style={[styles.smallBtnText, { color: palette.neon }]}>ACCEPT</Text>
                  </Pressable>
                  <Pressable onPress={() => respondBooking(b, 'reject')} style={[styles.smallBtn, { borderColor: '#ff3b5c', flex: 1 }]}>
                    <Text style={[styles.smallBtnText, { color: '#ff3b5c' }]}>REJECT</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionLabel}>MY UNITS</Text>
        {units.length === 0 ? <Text style={styles.emptyText}>No units yet. Add your first one.</Text> : null}
        {units.map(u => {
          const isListed = u.is_listed;
          const expires = u.listing_paid_until ? new Date(u.listing_paid_until).toLocaleDateString() : '—';
          return (
            <View key={u.id} style={styles.unitCard}>
              <View style={styles.unitHeader}>
                <Text style={styles.unitName}>{u.unit_name}</Text>
                <View style={[styles.badge, { borderColor: isListed ? palette.neon : p.textDim }]}>
                  <Text style={[styles.badgeText, { color: isListed ? palette.neon : p.textDim }]}>
                    {isListed ? 'LIVE' : 'HIDDEN'}
                  </Text>
                </View>
              </View>
              <Text style={styles.unitMeta}>{u.unit_type.toUpperCase()} · {u.capacity_tonnes}t · ₦{Number(u.daily_rate_per_tonne).toLocaleString()}/t/day</Text>
              <Text style={styles.unitMeta}>📍 {u.lga ? u.lga + ', ' : ''}{u.state}</Text>
              {isListed ? <Text style={styles.unitMeta}>Expires: {expires}</Text> : null}
              <Pressable onPress={() => toggleListing(u)} style={[styles.smallBtn, { borderColor: isListed ? '#ffb300' : palette.neon, marginTop: 10 }]}>
                <Text style={[styles.smallBtnText, { color: isListed ? '#ffb300' : palette.neon }]}>
                  {isListed ? 'UNLIST' : 'PAY ₦10K TO LIST'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Pressable onPress={() => setShowAdd(false)}><Text style={styles.back}>CANCEL</Text></Pressable>
            <Text style={styles.title}>Add Unit</Text>
            <Text style={styles.label}>UNIT NAME *</Text>
            <TextInput value={uName} onChangeText={setUName} style={styles.input} placeholder="Cold Room A1" placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['cold','dry','humidity','fumigation'].map(t => (
                <Pressable key={t} onPress={() => setUType(t)} style={[styles.chip, uType===t && styles.chipOn]}>
                  <Text style={[styles.chipText, uType===t && styles.chipTextOn]}>{t.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>STATE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
              {NIGERIAN_STATES.map(s => (
                <Pressable key={s} onPress={() => setUState(s)} style={[styles.chip, uState===s && styles.chipOn]}>
                  <Text style={[styles.chipText, uState===s && styles.chipTextOn]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>LGA</Text>
            <TextInput value={uLga} onChangeText={setULga} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>ADDRESS</Text>
            <TextInput value={uAddress} onChangeText={setUAddress} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>CAPACITY (TONNES) *</Text>
            <TextInput value={uCapacity} onChangeText={setUCapacity} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>DAILY RATE PER TONNE (₦) *</Text>
            <TextInput value={uRate} onChangeText={setURate} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>MIN BOOKING DAYS</Text>
            <TextInput value={uMinDays} onChangeText={setUMinDays} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />
            <Pressable onPress={addUnit} disabled={adding} style={styles.cta}>
              {adding ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>ADD UNIT</Text>}
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
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: p.surface, padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: p.border },
  statVal: { fontSize: 18, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: p.textMuted, marginTop: 4 },
  addBtn: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginBottom: 16 },
  addBtnText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 8, marginBottom: 8 },
  unitCard: { backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  unitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  unitName: { fontSize: 16, fontWeight: '900', color: p.text, flex: 1 },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  unitMeta: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  bookingCard: { backgroundColor: 'rgba(255,179,0,0.06)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)', marginBottom: 8 },
  bookingUnit: { fontSize: 15, fontWeight: '900', color: '#ffb300' },
  bookingMeta: { fontSize: 12, color: p.text, marginTop: 4 },
  bookingAmount: { fontSize: 13, color: p.text, marginTop: 4, fontWeight: '700' },
  bookingNotes: { fontSize: 11, color: p.textMuted, fontStyle: 'italic', marginTop: 6 },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  smallBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  emptyCard: { backgroundColor: p.surface, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: p.border, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 13, color: p.textMuted, textAlign: 'center', lineHeight: 20 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginTop: 16, width: '100%' },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  modalSheet: { backgroundColor: p.abyss, marginTop: 60, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },
});
