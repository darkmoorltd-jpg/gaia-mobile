import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function WarehouseNetwork() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<'all'|'cold'|'dry'>('all');
  const [selected, setSelected] = useState<any | null>(null);
  const [tonnes, setTonnes] = useState('');
  const [days, setDays] = useState('30');
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('warehouses').select('*').order('name');
      setWarehouses(data || []);
      setBusy(false);
    })();
  }, []);

  const filtered = warehouses.filter(w => {
    if (filter === 'cold') return w.cold_chain;
    if (filter === 'dry') return !w.cold_chain;
    return true;
  });

  const bookStorage = async () => {
    if (!tonnes || isNaN(Number(tonnes))) { Alert.alert('Enter tonnes'); return; }
    setBooking(true);
    const total = Number(tonnes) * Number(days) * selected.daily_rate_per_tonne;

    const { error } = await supabase.from('warehouse_bookings').insert({
      warehouse_id: selected.id,
      farmer_id: user.id,
      tonnes: Number(tonnes),
      days: Number(days),
      total_cost: total,
      status: 'active',
    });

    setBooking(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Booked!', `Reserved ${tonnes}t for ${days} days at ₦${total.toLocaleString()}`);
    setSelected(null);
    setTonnes('');
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

        {filtered.map(w => {
          const free = Number(w.capacity_tonnes) - Number(w.current_stock_tonnes);
          const pct = (Number(w.current_stock_tonnes) / Number(w.capacity_tonnes)) * 100;
          return (
            <View key={w.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{w.name}</Text>
                {w.cold_chain ? <Text style={styles.coldBadge}>❄️ COLD</Text> : <Text style={styles.dryBadge}>📦 DRY</Text>}
              </View>
              <Text style={styles.loc}>📍 {w.lga}, {w.state}</Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: pct > 80 ? '#ff3b5c' : pct > 50 ? '#ffb300' : palette.neon }]} />
              </View>
              <Text style={styles.capacity}>{Number(w.current_stock_tonnes).toFixed(0)}t used of {Number(w.capacity_tonnes).toFixed(0)}t · {free.toFixed(0)}t free</Text>
              <View style={styles.footer}>
                <Text style={styles.rate}>₦{Number(w.daily_rate_per_tonne).toLocaleString()}/t/day</Text>
                <Pressable onPress={() => setSelected(w)} style={styles.bookBtn}>
                  <Text style={styles.bookTxt}>BOOK STORAGE</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.title}>{selected?.name}</Text>
            <Text style={styles.sub}>📍 {selected?.state}</Text>

            <Text style={styles.label}>TONNES TO STORE</Text>
            <TextInput value={tonnes} onChangeText={setTonnes} keyboardType="numeric" placeholder="e.g. 5" placeholderTextColor="#888" style={styles.input} />

            <Text style={styles.label}>DAYS</Text>
            <TextInput value={days} onChangeText={setDays} keyboardType="numeric" placeholder="30" placeholderTextColor="#888" style={styles.input} />

            {tonnes && days ? (
              <View style={styles.totalBox}>
                <Text style={styles.totalLbl}>TOTAL</Text>
                <Text style={styles.totalVal}>₦{(Number(tonnes) * Number(days) * Number(selected?.daily_rate_per_tonne || 0)).toLocaleString()}</Text>
              </View>
            ) : null}

            <Pressable onPress={bookStorage} disabled={booking} style={styles.cta}>
              {booking ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>CONFIRM BOOKING</Text>}
            </Pressable>

            <Pressable onPress={() => setSelected(null)} style={{ marginTop: 16, alignItems: 'center' }}>
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
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  filterActive: { backgroundColor: p.neon, borderColor: p.neon },
  filterTxt: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '900', color: p.text, flex: 1 },
  coldBadge: { fontSize: 9, fontWeight: '900', color: '#4fc3f7', backgroundColor: 'rgba(79,195,247,0.15)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  dryBadge: { fontSize: 9, fontWeight: '900', color: '#ffb300', backgroundColor: 'rgba(255,179,0,0.15)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  loc: { fontSize: 11, color: p.textMuted, marginBottom: 12 },
  bar: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  barFill: { height: '100%', borderRadius: 3 },
  capacity: { fontSize: 11, color: p.textMuted, marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  rate: { fontSize: 13, fontWeight: '800', color: p.neon },
  bookBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: p.neon },
  bookTxt: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: p.abyss, padding: 24, borderRadius: 20 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: p.surface, padding: 16, borderRadius: 12, color: p.text, borderWidth: 1, borderColor: p.border },
  totalBox: { marginTop: 16, padding: 16, backgroundColor: 'rgba(0,255,136,0.1)', borderRadius: 12, alignItems: 'center' },
  totalLbl: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  totalVal: { fontSize: 26, fontWeight: '900', color: p.text, marginTop: 4 },
  cta: { backgroundColor: p.neon, padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
