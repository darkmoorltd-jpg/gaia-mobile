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
  'Cattle':          { group: 'LIVESTOCK', icon: '🐄', subs: ['Beef Cattle','Dairy Cattle','Cattle Fattening','Breeding'], countLabel: 'Number of Cattle', countUnit: 'heads', isLivestock: true },
  'Poultry':         { group: 'LIVESTOCK', icon: '🐔', subs: ['Broilers','Layers','Turkeys','Ducks','Guinea Fowl','Hatchery'], countLabel: 'Number of Birds', countUnit: 'birds', isLivestock: true },
  'Aquaculture':     { group: 'WATER', icon: '🐟', subs: ['Catfish','Tilapia','Mixed Fish','Hatchery'], countLabel: 'Number of Ponds', countUnit: 'ponds', isLivestock: true },
  'Agro-Processing': { group: 'SERVICES', icon: '🏭', subs: ['Garri Processing','Palm Oil','Rice Milling','Feed Production','Cheese/Dairy'] },
};

function computeFarmScale(hectares: number): string {
  if (hectares < 1) return 'Subsistence (< 1 Ha)';
  if (hectares < 2) return 'Small (< 2 Ha)';
  if (hectares < 10) return 'Medium (2-10 Ha)';
  if (hectares < 100) return 'Large (10-100 Ha)';
  return 'Commercial (> 100 Ha)';
}

export default function FarmProfile() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [farmerCategory, setFarmerCategory] = useState('Arable Crops');
  const [crop, setCrop] = useState('Maize');
  const [enterpriseCount, setEnterpriseCount] = useState('');
  const [farmSize, setFarmSize] = useState('1');
  const [landTenure, setLandTenure] = useState('Owned');
  const [householdSize, setHouseholdSize] = useState('1');
  const [isYouth, setIsYouth] = useState(false);
  const [farmingSeason, setFarmingSeason] = useState('Rainy');
  const [farmingPractices, setFarmingPractices] = useState<string[]>([]);
  
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  
  const [waterSource, setWaterSource] = useState('Rain-fed Only');
  const [storageType, setStorageType] = useState('None');
  const [assets, setAssets] = useState<string[]>([]);

  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('farmer_registry').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        setFarmerCategory(data.farmer_category || 'Arable Crops');
        setCrop(data.farmer_subcategory || 'Maize');
        setEnterpriseCount(data.enterprise_count?.toString() || '');
        setFarmSize(data.farm_size_acres?.toString() || '1');
        setLandTenure(data.land_tenure || 'Owned');
        setHouseholdSize(data.household_size?.toString() || '1');
        setIsYouth(data.youth || false);
        setFarmingSeason(data.farming_season || 'Rainy');
        setFarmingPractices(data.farming_practices || []);
        setBankName(data.bank_name || '');
        setBankAccountName(data.bank_account_name || '');
        setBankAccountNumber(data.bank_account_number || '');
        setWaterSource(data.water_source || 'Rain-fed Only');
        setStorageType(data.storage_type || 'None');
        setAssets(data.farm_assets || []);
        setGpsLat(data.gps_lat || null);
        setGpsLng(data.gps_lon || null);
      }
      setLoading(false);
    })();
  }, [user]);

  const togglePractice = (p: string) => setFarmingPractices(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
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
    setSaving(true);
    const hectares = parseFloat(farmSize) * 0.4047;
    const isLivestock = FARMER_CATEGORIES[farmerCategory].isLivestock === true;

    const payload = {
      user_id: user.id,
      state: 'Kaduna', // Ideally fetch from user_profiles, but left static for demo
      lga: 'Kaduna North',
      farm_size_acres: parseFloat(farmSize) || 1.0,
      crop: crop,
      farmer_category: farmerCategory,
      farmer_subcategory: crop,
      enterprise_count: enterpriseCount ? Number(enterpriseCount) : null,
      enterprise_unit: enterpriseCount ? (FARMER_CATEGORIES[farmerCategory].countUnit || 'units') : null,
      land_tenure: landTenure,
      farm_size_scale: computeFarmScale(hectares),
      household_size: Number(householdSize) || 1,
      youth: isYouth,
      farming_season: farmingSeason,
      farming_practices: farmingPractices,
      bank_name: bankName || null,
      bank_account_name: bankAccountName || null,
      bank_account_number: bankAccountNumber || null,
      water_source: waterSource,
      storage_type: storageType,
      farm_assets: assets,
      gps_lat: gpsLat,
      gps_lon: gpsLng,
    };

    const { error } = await supabase.from('farmer_registry').upsert(payload, { onConflict: 'user_id' });

    if (error) {
      Alert.alert('Failed', error.message);
    } else {
      // Also sync to user_profiles
      await supabase.from('user_profiles').update({
        primary_crops: crop,
        farm_size_acres: parseFloat(farmSize) || 1.0,
        farming_type: farmingSeason,
        years_experience: 0,
        bank_name: bankName || null,
        account_name: bankAccountName || null,
        account_number: bankAccountNumber || null,
      }).eq('user_id', user.id);

      Alert.alert('Saved!', 'Your NDFR Farm Profile has been updated.');
    }
    setSaving(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={palette.neon} size="large" /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Farm Profile</Text>
        <Text style={styles.sub}>Complete your National Digital Farmers Registry (NDFR) data.</Text>

        <Text style={styles.sectionLabel}>1. CATEGORY</Text>
        {['CROPS','LIVESTOCK','WATER','SERVICES'].map((group) => (
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
          {FARMER_CATEGORIES[farmerCategory].subs.map(sub => (
            <Pressable key={sub} onPress={() => setCrop(sub)} style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: crop === sub ? '#00ff88' : '#222' }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: crop === sub ? '#000' : '#888' }}>{sub}</Text>
            </Pressable>
          ))}
        </View>

        {FARMER_CATEGORIES[farmerCategory].countLabel && (
          <>
            <Text style={styles.label}>{FARMER_CATEGORIES[farmerCategory].countLabel?.toUpperCase()}</Text>
            <TextInput value={enterpriseCount} onChangeText={setEnterpriseCount} keyboardType="number-pad" style={styles.input} placeholder="e.g. 25" placeholderTextColor="#888" />
          </>
        )}

        <Text style={styles.sectionLabel}>2. LAND & FARM SIZE</Text>
        <Text style={styles.label}>FARM SIZE (ACRES)</Text>
        <TextInput value={farmSize} onChangeText={setFarmSize} keyboardType="numeric" style={styles.input} placeholderTextColor="#888" />
        <Text style={{ fontSize: 12, fontWeight: '800', color: '#00ff88', marginBottom: 10 }}>{computeFarmScale(parseFloat(farmSize) * 0.4047)}</Text>

        <Text style={styles.label}>LAND TENURE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Owned','Leased','Communal','Cooperative'].map(opt => (
            <Pressable key={opt} onPress={() => setLandTenure(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: landTenure === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: landTenure === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={captureGps} disabled={gpsBusy} style={[styles.cta, { backgroundColor: gpsLat ? 'rgba(0,255,136,0.2)' : '#222', borderWidth: 1, borderColor: '#00ff88', marginTop: 0, marginBottom: 10 }]}>
          {gpsBusy ? <ActivityIndicator color="#00ff88" /> : <Text style={{ color: '#00ff88', fontWeight: '900' }}>{gpsLat ? '✅ GPS CAPTURED' : '📍 PIN FARM GPS'}</Text>}
        </Pressable>

        <Text style={styles.sectionLabel}>3. HOUSEHOLD & PRACTICES</Text>
        <Text style={styles.label}>HOUSEHOLD SIZE</Text>
        <TextInput value={householdSize} onChangeText={setHouseholdSize} keyboardType="number-pad" style={styles.input} placeholderTextColor="#888" />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Youth (Under 35)</Text>
          <Pressable onPress={() => setIsYouth(!isYouth)} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: isYouth ? '#00ff88' : '#333', justifyContent: 'center', paddingHorizontal: 3 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: isYouth ? 'flex-end' : 'flex-start' }} />
          </Pressable>
        </View>

        <Text style={styles.label}>FARMING PRACTICES</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Crop rotation','Land rotation','Organic farming','Irrigation farming'].map(opt => (
            <Pressable key={opt} onPress={() => togglePractice(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: farmingPractices.includes(opt) ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: farmingPractices.includes(opt) ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>4. ASSETS & WATER</Text>
        <Text style={styles.label}>EQUIPMENT OWNED</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Tractor','Plough','Harrow','Water Pump','Sprayer','Generator','Motorcycle','Truck','Irrigation Kit','Thresher','Hand Tools Only'].map(opt => (
            <Pressable key={opt} onPress={() => toggleAsset(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: assets.includes(opt) ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: assets.includes(opt) ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>WATER SOURCE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Rain-fed Only','Well','Borehole','River/Stream','Dam','Irrigation Scheme'].map(opt => (
            <Pressable key={opt} onPress={() => setWaterSource(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: waterSource === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: waterSource === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>5. BANKING</Text>
        <TextInput value={bankName} onChangeText={setBankName} style={styles.input} placeholder="Bank name" placeholderTextColor="#888" />
        <TextInput value={bankAccountName} onChangeText={setBankAccountName} style={styles.input} placeholder="Account name" placeholderTextColor="#888" />
        <TextInput value={bankAccountNumber} onChangeText={setBankAccountNumber} keyboardType="number-pad" maxLength={10} style={styles.input} placeholder="Account number (NUBAN)" placeholderTextColor="#888" />

        <Pressable onPress={saveProfile} disabled={saving} style={[styles.cta, saving && { opacity: 0.5 }]}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>SAVE NDFR PROFILE</Text>}
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, backgroundColor: p.obsidian, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 24, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15, marginBottom: 10 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
