import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const GPS_INTERVAL_MS = 60_000; // every 60 seconds while in transit

export default function DriverApp() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [scanCode, setScanCode] = useState('');
  const [batch, setBatch] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [lastFix, setLastFix] = useState<string | null>(null);
  const [fixCount, setFixCount] = useState(0);
  const intervalRef = useRef<any>(null);

  // Stop tracking on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const findBatch = async () => {
    if (!scanCode.trim()) return;
    setBusy(true);
    const { data } = await supabase.from('batches').select('*').eq('batch_code', scanCode.trim().toUpperCase()).maybeSingle();
    if (!data) Alert.alert('Not Found', 'Batch not found.');
    else setBatch(data);
    setBusy(false);
  };

  const logLocation = async (batchId: string) => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await supabase.from('driver_locations').insert({
        batch_id: batchId,
        driver_id: user.id,
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        speed_kmh: loc.coords.speed ? loc.coords.speed * 3.6 : null,
        heading_deg: loc.coords.heading || null,
        accuracy_m: loc.coords.accuracy || null,
      });
      setLastFix(new Date().toLocaleTimeString());
      setFixCount(c => c + 1);
    } catch (e) {
      console.warn('GPS log failed', e);
    }
  };

  const startTracking = async (batchId: string) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location permission required');
      return;
    }
    setTracking(true);
    logLocation(batchId);
    intervalRef.current = setInterval(() => logLocation(batchId), GPS_INTERVAL_MS);
    Alert.alert('Tracking started', 'Your location is logged every 60 seconds while the app is open.');
  };

  const stopTracking = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setTracking(false);
  };

  const acceptCargo = async () => {
    setBusy(true);
    await supabase.from('batches').update({ status: 'in_transit' }).eq('id', batch.id);
    await supabase.from('batch_movements').insert({
      batch_id: batch.id,
      driver_id: user.id,
      from_location: batch.location || 'Farm',
      to_location: 'In Transit',
      quantity_kg: batch.quantity_kg,
      status: 'in_transit'
    });
    await supabase.from('batch_events').insert({
      batch_id: batch.id,
      event_type: 'dispatch',
      actor_id: user.id,
      notes: 'Driver accepted cargo',
    });
    setBusy(false);
    Alert.alert('Accepted', 'Cargo is in transit. Enable live tracking below.');
  };

  const deliverCargo = async () => {
    if (!batch) return;
    setBusy(true);
    stopTracking();
    await supabase.from('batches').update({ status: 'delivered' }).eq('id', batch.id);
    await supabase.from('batch_movements').insert({
      batch_id: batch.id,
      driver_id: user.id,
      from_location: 'In Transit',
      to_location: 'Delivery Point',
      quantity_kg: batch.quantity_kg,
      status: 'delivered',
      arrived_at: new Date().toISOString(),
    });
    await supabase.from('batch_events').insert({
      batch_id: batch.id,
      event_type: 'delivered',
      actor_id: user.id,
      notes: 'Driver marked cargo delivered',
    });
    setBusy(false);
    setBatch(null);
    setScanCode('');
    setFixCount(0);
    setLastFix(null);
    Alert.alert('Delivered', 'Cargo marked as delivered.');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Driver Logistics</Text>
        <Text style={styles.sub}>Scan to accept, deliver, and track cargo.</Text>

        <View style={styles.scannerBox}>
          <Text style={styles.label}>BATCH CODE</Text>
          <TextInput value={scanCode} onChangeText={setScanCode} placeholder="e.g. GAI-2025-MZ-0001" style={styles.input} autoCapitalize="characters" />
          <Pressable onPress={findBatch} disabled={busy} style={styles.btn}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>FIND CARGO</Text>}
          </Pressable>
        </View>

        {batch ? (
          <View style={styles.card}>
            <Text style={styles.batchCode}>{batch.batch_code}</Text>
            <Text style={styles.crop}>{batch.crop_name} · {batch.quantity_kg}kg</Text>
            <Text style={styles.loc}>From: {batch.location || 'Farm'}</Text>
            <Text style={styles.loc}>Status: {batch.status}</Text>

            {batch.status === 'active' ? (
              <Pressable onPress={acceptCargo} disabled={busy} style={[styles.btn, { backgroundColor: '#ffb300', marginTop: 16 }]}>
                <Text style={styles.btnTxt}>🚚 ACCEPT CARGO</Text>
              </Pressable>
            ) : null}

            {batch.status === 'in_transit' ? (
              <>
                <View style={styles.trackBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trackTitle}>Live GPS Tracking</Text>
                    <Text style={styles.trackMeta}>
                      {tracking ? 'Tracking every 60s · ' + fixCount + ' fixes sent' : 'Not tracking'}
                    </Text>
                    {lastFix ? <Text style={styles.trackMeta}>Last fix: {lastFix}</Text> : null}
                  </View>
                  <Switch value={tracking} onValueChange={(v) => v ? startTracking(batch.id) : stopTracking()} trackColor={{ false: '#333', true: '#ffb300' }} />
                </View>

                <Pressable onPress={deliverCargo} disabled={busy} style={[styles.btn, { backgroundColor: palette.neon, marginTop: 12 }]}>
                  <Text style={styles.btnTxt}>✅ MARK DELIVERED</Text>
                </Pressable>
              </>
            ) : null}

            {batch.status === 'delivered' ? (
              <Text style={styles.doneText}>✅ This cargo has been delivered.</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  scannerBox: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#ffb300', marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginBottom: 8 },
  input: { backgroundColor: p.obsidian, padding: 16, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border, marginBottom: 16, fontSize: 18, letterSpacing: 2, textAlign: 'center' },
  btn: { backgroundColor: '#ffb300', padding: 16, borderRadius: 10, alignItems: 'center' },
  btnTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  card: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: p.border },
  batchCode: { fontSize: 18, fontWeight: '900', color: p.text, fontFamily: 'monospace', textAlign: 'center' },
  crop: { fontSize: 14, color: p.textMuted, textAlign: 'center', marginTop: 8 },
  loc: { fontSize: 12, color: p.textDim, textAlign: 'center', marginTop: 4 },
  doneText: { fontSize: 14, color: p.neon, textAlign: 'center', marginTop: 16, fontWeight: '800' },
  trackBox: { marginTop: 16, padding: 16, backgroundColor: 'rgba(255,179,0,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)', flexDirection: 'row', alignItems: 'center' },
  trackTitle: { fontSize: 14, fontWeight: '900', color: '#ffb300' },
  trackMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
});
