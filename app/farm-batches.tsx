import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert,
  ActivityIndicator, Modal, Image, Share, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const CROPS = ['Maize','Rice','Cassava','Yam','Cocoa','Coffee','Soybean','Groundnut','Sorghum','Millet','Sesame','Palm Oil'];
const QUALITY = ['A','B','C'];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:     { label: 'ACTIVE',     color: '#00ff88', bg: 'rgba(0,255,136,0.12)' },
  in_storage: { label: 'IN STORAGE', color: '#4fc3f7', bg: 'rgba(79,195,247,0.12)' },
  sold:       { label: 'SOLD',       color: '#ffd700', bg: 'rgba(255,215,0,0.12)' },
  exported:   { label: 'EXPORTED',   color: '#b388ff', bg: 'rgba(179,136,255,0.12)' },
};

export default function FarmBatches() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [batches, setBatches] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total_kg: 0, batches: 0, active: 0, storage: 0 });
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all'|'active'|'in_storage'|'sold'|'exported'>('all');

  const [showCreate, setShowCreate] = useState(false);
  const [crop, setCrop] = useState('Maize');
  const [qty, setQty] = useState('');
  const [quality, setQuality] = useState('A');
  const [moisture, setMoisture] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<any | null>(null);
  const [qrModal, setQrModal] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data } = await supabase
        .from('batches')
        .select('*, batch_events(*), batch_movements(*)')
        .eq('farmer_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      const rows = data || [];
      setBatches(rows);

      const total_kg = rows.reduce((a: number, r: any) => a + Number(r.quantity_kg || 0), 0);
      const active = rows.filter((r: any) => r.status === 'active').length;
      const storage = rows.filter((r: any) => r.status === 'in_storage').length;
      setSummary({ total_kg, batches: rows.length, active, storage });
    } catch (e) {
      console.log('load error', e);
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 4,
    });
    if (!r.canceled) setPhotos([...photos, ...r.assets.map(a => a.uri)]);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission required'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!r.canceled) setPhotos([...photos, r.assets[0].uri]);
  };

  const captureGPS = async () => {
    setGpsBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Location permission required'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      Alert.alert('GPS captured', `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
    } catch (e: any) {
      Alert.alert('GPS failed', e.message);
    } finally {
      setGpsBusy(false);
    }
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      const path = user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error } = await supabase.storage.from('batch-photos').upload(path, bytes.buffer, { contentType: 'image/jpeg' });
      if (error) { console.warn('photo upload', error.message); return null; }
      return supabase.storage.from('batch-photos').getPublicUrl(path).data.publicUrl;
    } catch (e) {
      console.warn('photo ex', e);
      return null;
    }
  };

  const createBatch = async () => {
    if (!qty || isNaN(Number(qty))) { Alert.alert('Enter a valid quantity'); return; }
    setCreating(true);
    try {
      const photoUrls: string[] = [];
      for (const p of photos) {
        const url = await uploadPhoto(p);
        if (url) photoUrls.push(url);
      }

      const { data: codeData } = await supabase.rpc('generate_batch_code', { crop });
      const batchCode = codeData || 'GAI-MANUAL-' + Date.now();

      const { data, error } = await supabase.from('batches').insert({
        batch_code: batchCode,
        farmer_id: user.id,
        crop_name: crop,
        quantity_kg: Number(qty),
        quality_grade: quality,
        moisture_pct: moisture ? Number(moisture) : null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        photos: photoUrls,
        gps_lat: coords?.lat || null,
        gps_lon: coords?.lon || null,
        harvest_date: new Date().toISOString().split('T')[0],
        qr_url: `https://gaia-mobile-docs.vercel.app/trace.html?batch=${batchCode}`,
        status: 'active',
      }).select().single();

      if (error) throw error;

      await supabase.from('batch_events').insert({
        batch_id: data.id,
        event_type: 'harvest',
        actor_id: user.id,
        notes: `Harvested ${qty}kg of ${crop}${location ? ' at ' + location : ''}`,
      });

      setShowCreate(false);
      setCrop('Maize'); setQty(''); setQuality('A'); setMoisture(''); setLocation('');
      setNotes(''); setPhotos([]); setCoords(null);
      load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Try again');
    } finally {
      setCreating(false);
    }
  };

  const shareBatch = async (b: any) => {
    try {
      await Share.share({
        message: `GAIA Verified Harvest\n\nBatch: ${b.batch_code}\nCrop: ${b.crop_name}\nQuantity: ${b.quantity_kg}kg\nTrace: ${b.qr_url}`,
      });
    } catch (e: any) {
      console.warn('share', e);
    }
  };

  const filtered = batches.filter(b => filter === 'all' ? true : b.status === filter);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Harvest Batches</Text>
        <Text style={styles.sub}>Digital passports for your crops</Text>

        {/* SUMMARY */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryVal}>{summary.total_kg.toLocaleString()}</Text>
            <Text style={styles.summaryLbl}>TOTAL KG</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryVal}>{summary.batches}</Text>
            <Text style={styles.summaryLbl}>BATCHES</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={[styles.summaryVal, { color: palette.neon }]}>{summary.active}</Text>
            <Text style={styles.summaryLbl}>ACTIVE</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={[styles.summaryVal, { color: '#4fc3f7' }]}>{summary.storage}</Text>
            <Text style={styles.summaryLbl}>IN STORAGE</Text>
          </View>
        </View>

        <Pressable onPress={() => setShowCreate(true)} style={styles.cta}>
          <Text style={styles.ctaTxt}>+ CREATE NEW BATCH</Text>
        </Pressable>

        {/* FILTER TABS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 6 }}>
          {(['all','active','in_storage','sold','exported'] as const).map(f => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterActive]}>
              <Text style={[styles.filterTxt, filter === f && { color: '#000' }]}>{f.toUpperCase().replace('_',' ')}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {busy && batches.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {/* EMPTY STATE */}
        {!busy && filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'No harvest batches yet' : `No ${filter.replace('_',' ')} batches`}
            </Text>
            <Text style={styles.emptySub}>
              {filter === 'all' ? 'Create your first batch to start tracking your crops from farm to market.' : 'Try a different filter.'}
            </Text>
          </View>
        ) : null}

        {/* BATCH CARDS */}
        {filtered.map(b => {
          const meta = STATUS_META[b.status] || STATUS_META.active;
          const photos_count = Array.isArray(b.photos) ? b.photos.length : 0;
          const events_count = Array.isArray(b.batch_events) ? b.batch_events.length : 0;
          const movements_count = Array.isArray(b.batch_movements) ? b.batch_movements.length : 0;
          return (
            <Pressable key={b.id} onPress={() => setSelected(b)} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.batchCode}>{b.batch_code}</Text>
                <View style={[styles.statusBadge, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                  <Text style={[styles.statusTxt, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              <Text style={styles.cardCrop}>{b.crop_name} · {Number(b.quantity_kg).toLocaleString()} kg</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.metaItem}>Grade {b.quality_grade || 'A'}</Text>
                {b.moisture_pct ? <Text style={styles.metaItem}>{b.moisture_pct}% moisture</Text> : null}
                {b.location ? <Text style={styles.metaItem} numberOfLines={1}>📍 {b.location}</Text> : null}
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardDate}>{b.harvest_date}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {photos_count > 0 ? <Text style={styles.iconCount}>📷 {photos_count}</Text> : null}
                  {events_count > 0 ? <Text style={styles.iconCount}>📋 {events_count}</Text> : null}
                  {movements_count > 0 ? <Text style={styles.iconCount}>🚚 {movements_count}</Text> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* CREATE MODAL */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable onPress={() => setShowCreate(false)}><Text style={styles.back}>CANCEL</Text></Pressable>
              <Text style={styles.title}>New Batch</Text>
              <Text style={styles.sub}>Create a digital passport for this harvest.</Text>

              <Text style={styles.label}>CROP</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {CROPS.map(c => (
                  <Pressable key={c} onPress={() => setCrop(c)} style={[styles.chip, crop === c && styles.chipActive]}>
                    <Text style={[styles.chipTxt, crop === c && { color: '#000' }]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.label}>QUANTITY (KG) *</Text>
              <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" placeholder="e.g. 500" placeholderTextColor={palette.textDim} style={styles.input} />

              <Text style={styles.label}>QUALITY GRADE</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {QUALITY.map(q => (
                  <Pressable key={q} onPress={() => setQuality(q)} style={[styles.chip, quality === q && styles.chipActive, { flex: 1, justifyContent: 'center' }]}>
                    <Text style={[styles.chipTxt, quality === q && { color: '#000' }]}>Grade {q}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>MOISTURE % (optional)</Text>
              <TextInput value={moisture} onChangeText={setMoisture} keyboardType="numeric" placeholder="e.g. 7.5" placeholderTextColor={palette.textDim} style={styles.input} />

              <Text style={styles.label}>LOCATION / FARM</Text>
              <TextInput value={location} onChangeText={setLocation} placeholder="e.g. Zaria, Kaduna" placeholderTextColor={palette.textDim} style={styles.input} />

              <Text style={styles.label}>NOTES (optional)</Text>
              <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Any quality notes, weather, etc." placeholderTextColor={palette.textDim} style={[styles.input, { minHeight: 60 }]} />

              <Text style={styles.label}>HARVEST PHOTOS ({photos.length}/4)</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <Pressable onPress={takePhoto} style={styles.photoBtn}><Text style={styles.photoBtnTxt}>📷 Camera</Text></Pressable>
                <Pressable onPress={pickPhoto} style={styles.photoBtn}><Text style={styles.photoBtnTxt}>🖼 Gallery</Text></Pressable>
              </View>
              {photos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                  {photos.map((p, i) => (
                    <Pressable key={i} onPress={() => setPhotos(photos.filter((_, x) => x !== i))}>
                      <Image source={{ uri: p }} style={styles.thumb} />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <Pressable onPress={captureGPS} disabled={gpsBusy} style={[styles.photoBtn, coords && { borderColor: palette.neon }]}>
                {gpsBusy ? <ActivityIndicator color={palette.neon} /> : <Text style={[styles.photoBtnTxt, coords && { color: palette.neon }]}>
                  {coords ? `✅ GPS: ${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}` : '📍 Capture GPS Location'}
                </Text>}
              </Pressable>

              <Pressable onPress={createBatch} disabled={creating} style={[styles.cta, creating && { opacity: 0.5 }]}>
                {creating ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>GENERATE BATCH</Text>}
              </Pressable>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>CLOSE</Text></Pressable>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text style={styles.batchCode}>{selected?.batch_code}</Text>
                {selected ? (
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_META[selected.status]||STATUS_META.active).bg, borderColor: (STATUS_META[selected.status]||STATUS_META.active).color }]}>
                    <Text style={[styles.statusTxt, { color: (STATUS_META[selected.status]||STATUS_META.active).color }]}>
                      {(STATUS_META[selected.status]||STATUS_META.active).label}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.cardCrop, { marginTop: 8, fontSize: 22 }]}>
                {selected?.crop_name} · {Number(selected?.quantity_kg || 0).toLocaleString()} kg
              </Text>

              {/* QR + Share */}
              <View style={styles.detailActions}>
                <Pressable onPress={() => { setQrModal(selected); setSelected(null); }} style={[styles.actionBtn, { borderColor: palette.neon }]}>
                  <Text style={[styles.actionTxt, { color: palette.neon }]}>📱 SHOW QR</Text>
                </Pressable>
                <Pressable onPress={() => shareBatch(selected)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>📤 SHARE</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionLabel}>DETAILS</Text>
              <View style={styles.card}>
                <DetailRow k="Quality Grade" v={`Grade ${selected?.quality_grade || 'A'}`} styles={styles} />
                {selected?.moisture_pct ? <DetailRow k="Moisture" v={`${selected.moisture_pct}%`} styles={styles} /> : null}
                {selected?.location ? <DetailRow k="Location" v={selected.location} styles={styles} /> : null}
                <DetailRow k="Harvest Date" v={selected?.harvest_date || '—'} styles={styles} />
                {selected?.gps_lat ? <DetailRow k="GPS" v={`${selected.gps_lat.toFixed(4)}, ${selected.gps_lon.toFixed(4)}`} styles={styles} /> : null}
                {selected?.notes ? <DetailRow k="Notes" v={selected.notes} styles={styles} /> : null}
              </View>

              {/* Photos */}
              {Array.isArray(selected?.photos) && selected.photos.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>PHOTOS ({selected.photos.length})</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {selected.photos.map((url: string, i: number) => (
                      <Image key={i} source={{ uri: url }} style={{ width: 120, height: 120, borderRadius: 10 }} />
                    ))}
                  </ScrollView>
                </>
              ) : null}

              {/* Timeline */}
              <Text style={styles.sectionLabel}>TIMELINE</Text>
              {Array.isArray(selected?.batch_events) && selected.batch_events.length > 0 ? (
                selected.batch_events
                  .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((e: any, i: number) => (
                    <View key={i} style={styles.timelineRow}>
                      <View style={styles.dot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineType}>{(e.event_type || '').toUpperCase()}</Text>
                        {e.notes ? <Text style={styles.timelineNotes}>{e.notes}</Text> : null}
                        <Text style={styles.timelineDate}>{new Date(e.created_at).toLocaleString()}</Text>
                      </View>
                    </View>
                  ))
              ) : (
                <Text style={styles.emptySub}>No events yet.</Text>
              )}

              {/* Movements */}
              {Array.isArray(selected?.batch_movements) && selected.batch_movements.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>MOVEMENTS</Text>
                  {selected.batch_movements.map((m: any, i: number) => (
                    <View key={i} style={styles.movementCard}>
                      <Text style={styles.movementRoute}>{m.from_location || '?'} → {m.to_location || '?'}</Text>
                      {m.vehicle_plate ? <Text style={styles.movementMeta}>🚚 {m.vehicle_plate}</Text> : null}
                      {m.loss_kg > 0 ? <Text style={[styles.movementMeta, { color: '#ff3b5c' }]}>Loss: {m.loss_kg}kg {m.loss_reason ? '· ' + m.loss_reason : ''}</Text> : null}
                      <Text style={styles.movementMeta}>{new Date(m.dispatched_at).toLocaleString()}</Text>
                    </View>
                  ))}
                </>
              ) : null}

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QR MODAL */}
      <Modal visible={!!qrModal} animationType="fade" transparent onRequestClose={() => setQrModal(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { alignItems: 'center' }]}>
            <Text style={styles.batchCode}>{qrModal?.batch_code}</Text>
            <Text style={[styles.sub, { textAlign: 'center', marginTop: 8, marginBottom: 20 }]}>
              Scan to trace this batch
            </Text>
            <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 16 }}>
              {qrModal ? <QRCode value={qrModal.qr_url} size={220} /> : null}
            </View>
            <Pressable onPress={() => shareBatch(qrModal)} style={[styles.cta, { width: '100%', marginTop: 20 }]}>
              <Text style={styles.ctaTxt}>📤 SHARE BATCH</Text>
            </Pressable>
            <Pressable onPress={() => setQrModal(null)} style={{ marginTop: 16, padding: 8 }}>
              <Text style={{ color: palette.textMuted }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ k, v, styles }: any) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailKey}>{k}</Text>
      <Text style={styles.detailVal} numberOfLines={3}>{v}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryBox: { flex: 1, backgroundColor: p.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  summaryVal: { fontSize: 18, fontWeight: '900', color: p.text },
  summaryLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, marginTop: 4, letterSpacing: 1 },

  cta: { backgroundColor: p.neon, padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },

  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  filterActive: { backgroundColor: p.neon, borderColor: p.neon },
  filterTxt: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },

  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: p.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: p.textMuted, textAlign: 'center', lineHeight: 20 },

  card: { backgroundColor: p.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  batchCode: { fontSize: 15, fontWeight: '900', color: p.neon, fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardCrop: { fontSize: 16, fontWeight: '800', color: p.text },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' },
  metaItem: { fontSize: 11, color: p.textMuted },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  cardDate: { fontSize: 10, color: p.textDim },
  iconCount: { fontSize: 10, color: p.textMuted },

  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6, letterSpacing: 1 },
  input: { backgroundColor: p.surface, padding: 14, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon },
  chipTxt: { fontSize: 11, fontWeight: '800', color: p.text },
  photoBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  photoBtnTxt: { fontSize: 12, fontWeight: '800', color: p.text },
  thumb: { width: 80, height: 80, borderRadius: 8 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', padding: 16 },
  modalSheet: { backgroundColor: p.abyss, padding: 24, borderRadius: 20, maxHeight: '92%' },

  detailActions: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center' },
  actionTxt: { fontSize: 11, fontWeight: '900', color: p.text, letterSpacing: 1 },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 2, marginTop: 20, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  detailKey: { fontSize: 11, color: p.textMuted, flex: 1 },
  detailVal: { fontSize: 12, color: p.text, flex: 1.5, textAlign: 'right', fontWeight: '600' },

  timelineRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.neon, marginTop: 6 },
  timelineType: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  timelineNotes: { fontSize: 12, color: p.text, marginTop: 2 },
  timelineDate: { fontSize: 10, color: p.textDim, marginTop: 4 },

  movementCard: { backgroundColor: p.surface, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  movementRoute: { fontSize: 13, fontWeight: '800', color: p.text },
  movementMeta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
});
