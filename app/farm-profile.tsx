import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const FARMER_CATEGORIES: Record<string, { icon: string; subs: string[]; countLabel?: string; countUnit?: string; group: string; isLivestock?: boolean }> = {
  'Arable Crops':    { group: 'CROPS', icon: '🌾', subs: ['Maize','Rice','Sorghum','Millet','Cowpea','Soybean','Groundnut','Sesame','Wheat'] },
  'Tree Crops':      { group: 'CROPS', icon: '🌴', subs: ['Cocoa','Oil Palm','Coconut','Cashew','Rubber','Coffee','Kola Nut','Shea'], countLabel: 'Number of Trees', countUnit: 'trees' },
  'Horticulture':    { group: 'CROPS', icon: '🥬', subs: ['Tomato','Pepper','Onion','Cabbage','Lettuce','Carrot','Cucumber','Okra','Spinach','Watermelon'] },
  'Roots & Tubers':  { group: 'CROPS', icon: '🥔', subs: ['Cassava','Yam','Potato','Sweet Potato','Cocoyam','Ginger','Turmeric'] },
  'Cash Crops':      { group: 'CROPS', icon: '💵', subs: ['Cotton','Sugarcane','Tobacco','Jute','Kenaf'] },
  'Medicinal & Herbs': { group: 'CROPS', icon: '🌿', subs: ['Moringa','Bitter Leaf','Gongronema','Neem','Lemon Grass','Aloe Vera'] },
  'Cattle':          { group: 'LIVESTOCK', icon: '🐄', subs: ['Beef Cattle','Dairy Cattle','Cattle Fattening','Breeding'], countLabel: 'Number of Cattle', countUnit: 'heads', isLivestock: true },
  'Sheep & Goats':   { group: 'LIVESTOCK', icon: '🐐', subs: ['Sheep','Goats','Both'], countLabel: 'Number of Animals', countUnit: 'animals', isLivestock: true },
  'Poultry':         { group: 'LIVESTOCK', icon: '🐔', subs: ['Broilers','Layers','Turkeys','Ducks','Guinea Fowl'], countLabel: 'Number of Birds', countUnit: 'birds', isLivestock: true },
  'Micro Livestock': { group: 'LIVESTOCK', icon: '🐇', subs: ['Rabbits','Guinea Pigs','Grasscutter'], countLabel: 'Number of Units', countUnit: 'units', isLivestock: true },
  'Aquaculture':     { group: 'WATER', icon: '🐟', subs: ['Catfish','Tilapia','Mixed Fish','Hatchery'], countLabel: 'Number of Ponds', countUnit: 'ponds', isLivestock: true },
  'Agro-Processing': { group: 'SERVICES', icon: '🏭', subs: ['Garri Processing','Palm Oil','Rice Milling','Feed Production','Fruit Juice','Packaging'] },
  'Seed/Nursery':    { group: 'SERVICES', icon: '🌾', subs: ['Seed Production','Seedlings','Grafting'] },
};

export default function FarmProfile() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alreadyComplete, setAlreadyComplete] = useState(false);

  const [farmerCategory, setFarmerCategory] = useState('Arable Crops');
  const [crop, setCrop] = useState('Maize');
  const [enterpriseCount, setEnterpriseCount] = useState('');
  const [farmSize, setFarmSize] = useState('1');
  const [landTenure, setLandTenure] = useState('Owned');
  const [farmingSeason, setFarmingSeason] = useState('Rainy');
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  const [householdSize, setHouseholdSize] = useState('1');
  const [isYouth, setIsYouth] = useState(false);
  const [vulnerability, setVulnerability] = useState<string[]>([]);
  const [waterSource, setWaterSource] = useState('Rain-fed Only');
  const [assets, setAssets] = useState<string[]>([]);
  const [isCoopMember, setIsCoopMember] = useState(false);
  const [hasCredit, setHasCredit] = useState(false);
  const [hasInsurance, setHasInsurance] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const { data: fr } = await supabase.from('farmer_registry').select('*').eq('user_id', user.id).maybeSingle();
        if (fr && fr.farmer_category) {
          // Already has a profile
          setAlreadyComplete(true);
        }
      } catch {}
      setLoading(false);
    })();
  }, [user]);

  const toggleVulnerability = (v: string) => setVulnerability(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleAsset = (a: string) => setAssets(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);

  const captureGps = async () => {
    setGpsBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Permission denied'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGpsLat(loc.coords.latitude);
      setGpsLng(loc.coords.longitude);
    } catch (e: any) { Alert.alert('GPS failed', e.message); }
    finally { setGpsBusy(false); }
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!gpsLat) { Alert.alert('GPS Required', 'Please pin your farm location.'); return; }
    setSaving(true);
    try {
      const data = {
        user_id: user.id,
        state: 'Kaduna', // will be overwritten from profile in real app
        lga: null,
        crop: crop,
        farm_size_acres: parseFloat(farmSize) || 1.0,
        farmer_type: farmingSeason,
        gender: 'Unknown',
        youth: isYouth,
        gps_lat: gpsLat,
        gps_lon: gpsLng,
        farmer_category: farmerCategory,
        farmer_subcategory: crop,
        enterprise_count: enterpriseCount ? Number(enterpriseCount) : null,
        enterprise_unit: enterpriseCount ? (FARMER_CATEGORIES[farmerCategory].countUnit || 'units') : null,
        land_tenure: landTenure,
        household_size: Number(householdSize) || 1,
        vulnerability_status: vulnerability.length > 0 ? vulnerability : null,
        water_source: waterSource,
        farm_assets: assets.length > 0 ? assets : null,
        is_coop_member: isCoopMember,
        has_credit_access: hasCredit,
        has_insurance: hasInsurance,
        registered_by_agent: null, // Self-registered
      };

      // Upsert farmer_registry
      const { error: frErr } = await supabase.from('farmer_registry').upsert(data, { onConflict: 'user_id' });
      if (frErr) throw frErr;

      // Mirror to user_profiles
      const { error: upErr } = await supabase.from('user_profiles').update({
        primary_crops: crop,
        farm_size_acres: parseFloat(farmSize) || 1.0,
        farming_type: farmingSeason,
        youth: isYouth,
        farmer_category: farmerCategory,
        farmer_subcategory: crop,
        enterprise_count: enterpriseCount ? Number(enterpriseCount) : null,
        enterprise_unit: enterpriseCount ? (FARMER_CATEGORIES[farmerCategory].countUnit || 'units') : null,
        land_tenure: landTenure,
        household_size: Number(householdSize) || 1,
        vulnerability_status: vulnerability.length > 0 ? vulnerability : null,
        water_source: waterSource,
        farm_assets: assets.length > 0 ? assets : null,
        is_coop_member: isCoopMember,
        has_credit_access: hasCredit,
        has_insurance: hasInsurance,
        ndfr_complete: true,
      }).eq('user_id', user.id);
      if (upErr) console.warn('profile mirror failed', upErr);

      Alert.alert('Farm Profile Saved', 'Your NDFR profile is now complete. Welcome to the registry.');
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  if (alreadyComplete) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 64, marginBottom: 20 }}>🌾</Text>
        <Text style={styles.title}>Profile Already Complete</Text>
        <Text style={styles.sub}>Your farm profile is registered in the NDFR. Contact support to make changes.</Text>
        <Pressable onPress={() => router.back()} style={[styles.cta, { marginTop: 32, width: '100%' }]}>
          <Text style={styles.ctaText}>BACK TO HOME</Text>
        </Pressable>
      </View>
    );
  }

  const countInfo = FARMER_CATEGORIES[farmerCategory];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Complete Farm Profile</Text>
        <Text style={styles.sub}>Join the National Digital Farmers Registry (NDFR).</Text>

        <Text style={styles.sectionLabel}>1. WHAT DO YOU FARM?</Text>
        {(['CROPS','LIVESTOCK','WATER','SERVICES'] as const).map((group) => (
          <View key={group} style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#666', letterSpacing: 1.5, marginBottom: 6 }}>{group}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(FARMER_CATEGORIES).filter(([_, v]) => v.group === group).map(([cat, v]) => (
                <Pressable key={cat} onPress={() => { setFarmerCategory(cat); setCrop(v.subs[0]); }} style={{ width: '31%', padding: 10, borderRadius: 8, backgroundColor: farmerCategory === cat ? '#00ff88' : '#222', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 18 }}>{v.icon}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: farmerCategory === cat ? '#000' : '#888', marginTop: 2, textAlign: 'center' }} numberOfLines={2}>{cat}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.label}>PRIMARY ENTERPRISE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {countInfo.subs.map(sub => (
            <Pressable key={sub} onPress={() => setCrop(sub)} style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: crop === sub ? '#00ff88' : '#222' }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: crop === sub ? '#000' : '#888' }}>{sub}</Text>
            </Pressable>
          ))}
        </View>

        {countInfo.countLabel && (
          <>
            <Text style={styles.label}>{countInfo.countLabel.toUpperCase()}</Text>
            <TextInput value={enterpriseCount} onChangeText={setEnterpriseCount} keyboardType="number-pad" style={styles.input} placeholder="e.g. 25" placeholderTextColor="#888" />
          </>
        )}

        <Text style={styles.sectionLabel}>2. FARM SIZE & LOCATION</Text>
        <Text style={styles.label}>FARM SIZE (ACRES)</Text>
        <TextInput value={farmSize} onChangeText={setFarmSize} keyboardType="numeric" style={styles.input} placeholderTextColor="#888" />

        <Pressable onPress={captureGps} disabled={gpsBusy} style={[styles.gpsBtn, gpsLat && styles.gpsBtnOn]}>
          {gpsBusy ? <ActivityIndicator color="#00ff88" /> : <Text style={{ color: gpsLat ? '#000' : '#00ff88', fontWeight: '900' }}>{gpsLat ? '✅ GPS CAPTURED: ' + gpsLat.toFixed(4) + ', ' + gpsLng?.toFixed(4) : '📍 PIN FARM LOCATION'}</Text>}
        </Pressable>

        <Text style={styles.label}>LAND TENURE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Owned','Leased','Communal','Cooperative'].map(opt => (
            <Pressable key={opt} onPress={() => setLandTenure(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: landTenure === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: landTenure === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>FARMING SEASON</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {['Rainy','Dry','Both'].map(opt => (
            <Pressable key={opt} onPress={() => setFarmingSeason(opt)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: farmingSeason === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: farmingSeason === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>3. HOUSEHOLD & VULNERABILITY</Text>
        <Text style={styles.label}>HOUSEHOLD SIZE</Text>
        <TextInput value={householdSize} onChangeText={setHouseholdSize} keyboardType="number-pad" style={styles.input} placeholderTextColor="#888" />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Are you under 35 (Youth)?</Text>
          <Pressable onPress={() => setIsYouth(!isYouth)} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: isYouth ? '#00ff88' : '#333', justifyContent: 'center', paddingHorizontal: 3 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: isYouth ? 'flex-end' : 'flex-start' }} />
          </Pressable>
        </View>

        <Text style={styles.label}>VULNERABILITY (Select all that apply)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['IDP','Refugee','Disabled','Elderly (60+)','Single Mother','Orphan-headed','Chronically Ill'].map(opt => (
            <Pressable key={opt} onPress={() => toggleVulnerability(opt)} style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: vulnerability.includes(opt) ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: vulnerability.includes(opt) ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>4. WATER & ASSETS</Text>
        <Text style={styles.label}>WATER SOURCE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Rain-fed Only','Well','Borehole','River/Stream','Dam','Irrigation'].map(opt => (
            <Pressable key={opt} onPress={() => setWaterSource(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: waterSource === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: waterSource === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>EQUIPMENT OWNED</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Tractor','Plough','Water Pump','Sprayer','Generator','Motorcycle','Truck','Hand Tools Only'].map(opt => (
            <Pressable key={opt} onPress={() => toggleAsset(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: assets.includes(opt) ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: assets.includes(opt) ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>5. FINANCIAL ACCESS</Text>
        <View style={{ gap: 6, marginBottom: 12 }}>
          {[
            { label: 'Member of Cooperative', val: isCoopMember, set: setIsCoopMember },
            { label: 'Has access to Agricultural Credit', val: hasCredit, set: setHasCredit },
            { label: 'Has Agricultural Insurance', val: hasInsurance, set: setHasInsurance },
          ].map((item, i) => (
            <Pressable key={i} onPress={() => item.set(!item.val)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, backgroundColor: item.val ? 'rgba(0,255,136,0.1)' : '#222', borderWidth: 1, borderColor: item.val ? '#00ff88' : '#333' }}>
              <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: item.val ? '#00ff88' : 'transparent', borderWidth: 2, borderColor: item.val ? '#00ff88' : '#666', alignItems: 'center', justifyContent: 'center' }}>
                {item.val ? <Text style={{ fontSize: 12, fontWeight: '900', color: '#000' }}>✓</Text> : null}
              </View>
              <Text style={{ fontSize: 13, color: '#fff', flex: 1 }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={saveProfile} disabled={saving} style={[styles.cta, saving && { opacity: 0.5 }]}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>SAVE FARM PROFILE</Text>}
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, backgroundColor: p.obsidian, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 24, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15, marginBottom: 10 },
  gpsBtn: { padding: 16, borderRadius: 12, backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 1.5, borderColor: p.neon, alignItems: 'center', marginBottom: 12, marginTop: 8 },
  gpsBtnOn: { backgroundColor: '#00ff88' },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
