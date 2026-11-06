import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function WarehouseNetwork() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [units, setUnits] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<'all'|'cold'|'dry'>('all');
  const [selected, setSelected] = useState<any>(null);
  const [tonnes, setTonnes] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30*86400000).toISOString().slice(0,10));
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.from('warehouse_units')
      .select('*, warehouse_companies(company_name, rating, verification_status)')
      .eq('is_listed', true)
      .eq('status', 'active')
      .gt('listing_paid_until', new Date().toISOString())
      .order('featured_until', { ascending: false, nullsFirst: false });
    setUnits(data || []);
    setBusy(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = units.filter(u => {
    if (filter === 'cold') return u.unit_type === 'cold';
    if (filter === 'dry') return u.unit_type === 'dry';
    return true;
  });

  const bookStorage = async () => {
    if (!user) { Alert.alert('Please log in'); return; }
    if (!tonnes || isNaN(Number(tonnes))) { Alert.alert('Enter tonnes'); return; }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) { Alert.alert('End date must be after start date'); return; }
    const days = Math.floor((end.getTime() - start.getTime()) / 86400000);
    const total = days * Number(tonnes) * Number(selected.daily_rate_per_tonne);

    Alert.alert(
      'Confirm Booking',
      `${tonnes}t for ${days} days\nTotal: ₦${total.toLocaleString()}\n(8% GAIA fee included)`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay Now', onPress: async () => {
          setBooking(true);
          const ref = 'GAIA_STOR_' + Date.now().toString(36).toUpperCase();
          const { data, error } = await supabase.rpc('create_warehouse_booking', {
            p_unit_id: selected.id,
            p_start_date: startDate,
            p_end_date: endDate,
            p_tonnes: Number(tonnes),
            p_payment_ref: ref,
            p_farmer_notes: notes.trim() || null,
          });
          setBooking(false);
          if (error) { Alert.alert('Booking failed', error.message); return; }
          Alert.alert('Booked!', `Total ₦${total.toLocaleString()}. Warehouse will confirm within 24hrs.`);
          setSelected(null); setTonnes(''); setNotes('');
        }},
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Warehouse Network</Text>
        <Text style={styles.sub}>Verified storage across Nigeria</Text>

        <View style={styles.filterRow}>
          {(['all','cold','dry'] as const).map(f => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterActive]}>
              <Text style={[styles.filterTxt, filter === f && { color: '#000' }]}>{f.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {!busy && filtered.length === 0 ? <Text style={styles.empty}>No warehouses listed yet. Check back soon.</Text> : null}

        {filtered.map(w => {
          const free = Number(w.capacity_tonnes) - Number(w.occupied_tonnes || 0);
          const pct = (Number(w.occupied_tonnes || 0) / Number(w.capacity_tonnes)) * 100;
          const isFeatured = w.featured_until && new Date(w.featured_until) > new Date();
          return (
            <View key={w.id} style={[styles.card, isFeatured && { borderColor: '#ffd700' }]}>
              <View style={styles.row}>
                <Text style={styles.name}>{w.warehouse_companies?.company_name || 'Warehouse'}</Text>
                {isFeatured ? <Text style={styles.featuredBadge}>⭐ FEATURED</Text> : null}
              </View>
              <Text style={styles.unitName}>{w.unit_name}</Text>
              <Text style={styles.loc}>📍 {w.lga ? w.lga + ', ' : ''}{w.state}</Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.min(pct,100)}%`, backgroundColor: pct > 80 ? '#ff3b5c' : pct > 50 ? '#ffb300' : palette.neon }]} />
              </View>
              <Text style={styles.capacity}>{Number(w.occupied_tonnes || 0).toFixed(0)}t used of {Number(w.capacity_tonnes).toFixed(0)}t · {free.toFixed(0)}t free</Text>
              <View style={styles.footer}>
                <Text style={styles.rate}>₦{Number(w.daily_rate_per_tonne).toLocaleString()}/t/day</Text>
                <Pressable onPress={() => setSelected(w)} style={styles.bookBtn}>
                  <Text style={styles.bookTxt}>BOOK NOW</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>CANCEL</Text></Pressable>
            <Text style={styles.title}>{selected?.unit_name}</Text>
            <Text style={styles.sub}>{selected?.warehouse_companies?.company_name} · {selected?.state}</Text>

            <Text style={styles.label}>TONNES</Text>
            <TextInput value={tonnes} onChangeText={setTonnes} keyboardType="numeric" placeholder="e.g. 5" placeholderTextColor={palette.textDim} style={styles.input} />

            <Text style={styles.label}>START DATE (YYYY-MM-DD)</Text>
            <TextInput value={startDate} onChangeText={setStartDate} placeholderTextColor={palette.textDim} style={styles.input} />

            <Text style={styles.label}>END DATE (YYYY-MM-DD)</Text>
            <TextInput value={endDate} onChangeText={setEndDate} placeholderTextColor={palette.textDim} style={styles.input} />

            <Text style={styles.label}>NOTES (optional)</Text>
            <TextInput value={notes} onChangeText={setNotes} multiline placeholderTextColor={palette.textDim} style={[styles.input, { minHeight: 60 }]} />

            {tonnes && selected ? (() => {
              const days = Math.max(1, Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
              const total = days * Number(tonnes) * Number(selected.daily_rate_per_tonne);
              return (
                <View style={styles.totalBox}>
                  <Text style={styles.totalLbl}>{days} DAYS · {tonnes}t</Text>
                  <Text style={styles.totalVal}>₦{total.toLocaleString()}</Text>
                </View>
              );
            })() : null}

            <Pressable onPress={bookStorage} disabled={booking} style={styles.cta}>
              {booking ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>CONFIRM & PAY</Text>}
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
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  filterActive: { backgroundColor: p.neon, borderColor: p.neon },
  filterTxt: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 14, fontWeight: '900', color: p.text, flex: 1 },
  featuredBadge: { fontSize: 9, fontWeight: '900', color: '#ffd700', backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  unitName: { fontSize: 13, color: p.textMuted, marginTop: 2 },
  loc: { fontSize: 11, color: p.textMuted, marginTop: 4, marginBottom: 12 },
  bar: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  barFill: { height: '100%', borderRadius: 3 },
  capacity: { fontSize: 11, color: p.textMuted, marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  rate: { fontSize: 13, fontWeight: '800', color: p.neon },
  bookBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: p.neon },
  bookTxt: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  modalSheet: { backgroundColor: p.abyss, marginTop: 60, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  totalBox: { marginTop: 16, padding: 16, backgroundColor: 'rgba(0,255,136,0.08)', borderRadius: 12, alignItems: 'center' },
  totalLbl: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  totalVal: { fontSize: 26, fontWeight: '900', color: p.text, marginTop: 4 },
  cta: { backgroundColor: p.neon, padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
