import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const PAYSTACK_PUBLIC = 'pk_live_3af5d245e74f86f0517d214b6872f4ac8236e057';
const FEE_KOBO = 200000;

const FARMER_CATEGORIES: Record<string, { icon: string; subs: string[]; countLabel?: string; countUnit?: string; group: string; assetName: string; isLivestock?: boolean }> = {
  'Arable Crops':    { group: 'CROPS', icon: '🌾', subs: ['Maize','Rice','Sorghum','Millet','Cowpea','Soybean','Groundnut','Sesame','Wheat'], assetName: 'Crop Field' },
  'Tree Crops':      { group: 'CROPS', icon: '🌴', subs: ['Cocoa','Oil Palm','Coconut','Cashew','Rubber','Coffee','Kola Nut','Shea'], countLabel: 'Number of Trees', countUnit: 'trees', assetName: 'Tree Plantation' },
  'Horticulture':    { group: 'CROPS', icon: '🥬', subs: ['Tomato','Pepper','Onion','Cabbage','Lettuce','Carrot','Cucumber','Okra','Spinach','Watermelon'], assetName: 'Vegetable Garden' },
  'Roots & Tubers':  { group: 'CROPS', icon: '🥔', subs: ['Cassava','Yam','Potato','Sweet Potato','Cocoyam','Ginger','Turmeric'], assetName: 'Roots Field' },
  'Cash Crops':      { group: 'CROPS', icon: '💵', subs: ['Cotton','Sugarcane','Tobacco','Jute','Kenaf'], assetName: 'Cash Crop Field' },
  'Cattle':          { group: 'LIVESTOCK', icon: '🐄', subs: ['Beef Cattle','Dairy Cattle','Cattle Fattening','Breeding'], countLabel: 'Number of Cattle', countUnit: 'heads', assetName: 'Cattle Ranch', isLivestock: true },
  'Sheep & Goats':   { group: 'LIVESTOCK', icon: '🐐', subs: ['Sheep','Goats','Both'], countLabel: 'Number of Animals', countUnit: 'animals', assetName: 'Sheep/Goat Pen', isLivestock: true },
  'Poultry':         { group: 'LIVESTOCK', icon: '🐔', subs: ['Broilers','Layers','Turkeys','Ducks','Guinea Fowl','Hatchery'], countLabel: 'Number of Birds', countUnit: 'birds', assetName: 'Poultry House', isLivestock: true },
  'Aquaculture':     { group: 'WATER', icon: '🐟', subs: ['Catfish','Tilapia','Mixed Fish','Hatchery'], countLabel: 'Number of Ponds', countUnit: 'ponds', assetName: 'Fish Pond', isLivestock: true },
  'Beekeeping':      { group: 'LIVESTOCK', icon: '🐝', subs: ['Honey Production','Bee Products','Pollination Services'], countLabel: 'Number of Hives', countUnit: 'hives', assetName: 'Apiary', isLivestock: true },
  'Agro-Processing': { group: 'SERVICES', icon: '🏭', subs: ['Garri Processing','Palm Oil','Rice Milling','Feed Production','Cheese/Dairy','Fruit Juice'], assetName: 'Processing Facility' },
};

function computeFarmScale(hectares: number): string {
  if (hectares < 1) return 'Subsistence (< 1 Ha)';
  if (hectares < 2) return 'Small (< 2 Ha)';
  if (hectares < 10) return 'Medium (2-10 Ha)';
  if (hectares < 100) return 'Large (10-100 Ha)';
  return 'Commercial (> 100 Ha)';
}

function newRef(agentId: string) {
  return 'GAIA_VER_' + (agentId || 'x').slice(0, 8) + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

interface Farmer { user_id: string; name: string; bucket?: string; farm_details_complete?: boolean; has_polygon?: boolean; }

export default function AgentVerify() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmerId?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  // ── Pick farmer ──
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selected, setSelected] = useState<Farmer | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Farm details ──
  const [farmerCategory, setFarmerCategory] = useState('Arable Crops');
  const [crop, setCrop] = useState('Maize');
  const [enterpriseCount, setEnterpriseCount] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [landAreaHectares, setLandAreaHectares] = useState('');
  const [landTenure, setLandTenure] = useState('Owned');
  const [titleType, setTitleType] = useState('None');
  const [titleNumber, setTitleNumber] = useState('');
  const [farmOrientation, setFarmOrientation] = useState('Stand Alone');
  const [farmingPractices, setFarmingPractices] = useState<string[]>([]);
  const [farmingStartYear, setFarmingStartYear] = useState('');
  const [farmingSeason, setFarmingSeason] = useState('Rainy');
  const [expectedYield, setExpectedYield] = useState('');
  const [lastHarvestYield, setLastHarvestYield] = useState('');
  const [waterSource, setWaterSource] = useState('Rain-fed Only');
  const [storageType, setStorageType] = useState('None');
  const [assets, setAssets] = useState<string[]>([]);

  // ── Livestock ──
  const [livestockBreed, setLivestockBreed] = useState('');
  const [vaccinationStatus, setVaccinationStatus] = useState('Not Vaccinated');
  const [vetContact, setVetContact] = useState('');
  const [mortalityLastCycle, setMortalityLastCycle] = useState('');

  // ── GPS + photos ──
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [assetPhoto, setAssetPhoto] = useState<string | null>(null);

  // ── Payment ──
  const [busy, setBusy] = useState(false);
  const [payRef, setPayRef] = useState<string | null>(null);
  const [uploadedAssetUrl, setUploadedAssetUrl] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  const isLivestock = FARMER_CATEGORIES[farmerCategory]?.isLivestock === true;
  const assetName = FARMER_CATEGORIES[farmerCategory]?.assetName || 'Farm';

  useEffect(() => {
    (async () => {
      try {
        const r = await supabase.rpc('agent_my_farmers', { p_filter: 'all', p_search: null, p_limit: 300 });
        const list: Farmer[] = (r.data || []).map((f: any) => ({
          user_id: f.user_id,
          name: f.name || 'Farmer',
          bucket: f.bucket,
          farm_details_complete: f.farm_details_complete,
          has_polygon: f.has_polygon,
        }));
        setFarmers(list);
        if (params.farmerId) {
          const found = list.find(x => x.user_id === params.farmerId);
          if (found) setSelected(found);
        }
      } catch {}
      try {
        const wr = await supabase.rpc('agent_wallet_get');
        if (!wr.error && wr.data) setWalletBalance(Number(wr.data.balance || 0));
      } catch {}
      setLoading(false);
    })();
  }, [params.farmerId]);

  const pickImage = async (setter: (v: string) => void) => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled) setter(res.assets[0].uri);
  };

  const uploadFile = async (uri: string, name: string): Promise<string | null> => {
    try {
      const sess = await supabase.auth.getSession();
      const agentId = sess.data.session?.user?.id;
      if (!agentId) return null;
      const response = await fetch(uri);
      const blob = await response.blob();
      const path = 'agents/' + agentId + '/' + name + '_' + Date.now() + '.jpg';
      const up = await supabase.storage.from('verifications').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) return null;
      const { data } = supabase.storage.from('verifications').createSignedUrl(path, 60 * 60 * 24 * 365);
      return data?.signedUrl || null;
    } catch { return null; }
  };

  const captureGps = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Permission denied'); return; }
      setGpsBusy(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGpsLat(loc.coords.latitude);
      setGpsLng(loc.coords.longitude);
    } catch (e: any) { Alert.alert('GPS failed', e.message); }
    finally { setGpsBusy(false); }
  };

  const togglePractice = (p: string) => setFarmingPractices(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const toggleAsset = (a: string) => setAssets(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  const validateFarm = (): string | null => {
    if (!farmSize || parseFloat(farmSize) <= 0) return 'Farm size required';
    if (gpsLat == null || gpsLng == null) return 'Tap "Capture GPS" to pin the farm';
    if (!assetPhoto) return `Take a photo of the ${assetName.toLowerCase()}`;
    return null;
  };

  const completeFarmAndPay = async () => {
    if (!selected) return;
    const err = validateFarm();
    if (err) { Alert.alert('Missing', err); return; }

    // If farmer already has farm details complete, jump straight to payment
    if (!selected.farm_details_complete) {
      setBusy(true);
      try {
        const assetUrl = await uploadFile(assetPhoto!, 'asset');
        setUploadedAssetUrl(assetUrl);

        const { error: updErr } = await supabase.rpc('agent_update_farm_details', {
          p_farmer_id: selected.user_id,
          p_data: {
            farmer_category: farmerCategory,
            farmer_subcategory: crop,
            primary_crops: crop,
            enterprise_count: enterpriseCount ? Number(enterpriseCount) : null,
            enterprise_unit: enterpriseCount ? (FARMER_CATEGORIES[farmerCategory]?.countUnit || 'units') : null,
            farm_size_acres: parseFloat(farmSize) || null,
            land_area_hectares: landAreaHectares ? Number(landAreaHectares) : null,
            farm_size_scale: computeFarmScale(parseFloat(farmSize) * 0.4047),
            land_tenure: landTenure,
            title_type: titleType !== 'None' ? titleType : null,
            title_number: titleNumber || null,
            farm_orientation: farmOrientation,
            farming_practices: farmingPractices,
            farming_start_year: farmingStartYear ? Number(farmingStartYear) : null,
            farming_season: farmingSeason,
            gps_lat: gpsLat,
            gps_lng: gpsLng,
            asset_photo_url: assetUrl,
            livestock_breed: livestockBreed || null,
            vaccination_status: isLivestock ? vaccinationStatus : null,
            vet_contact: vetContact || null,
            mortality_last_cycle: mortalityLastCycle ? Number(mortalityLastCycle) : null,
            farm_assets: assets,
            water_source: waterSource,
            storage_type: storageType,
            expected_yield_kg: expectedYield ? Number(expectedYield) : null,
            last_harvest_yield_kg: lastHarvestYield ? Number(lastHarvestYield) : null,
          },
        });
        if (updErr) throw updErr;

        setSelected({ ...selected, farm_details_complete: true });
        setBusy(false);

        // Prompt for payment
        Alert.alert('Farm Saved ✅', 'Farm details captured. Now pay the ₦2,000 verification fee.', [
          { text: 'Pay now', onPress: () => startPayment() },
        ]);
      } catch (e: any) {
        Alert.alert('Save failed', e.message);
        setBusy(false);
      }
    } else {
      startPayment();
    }
  };

  const startPayment = async () => {
    if (!selected) return;

    // Wallet path
    if (walletBalance >= FEE_KOBO / 100) {
      setBusy(true);
      try {
        const { data: wres, error: wErr } = await supabase.rpc('agent_wallet_pay_verification', {
          p_farmer_id: selected.user_id,
          p_amount: FEE_KOBO / 100,
          p_kyc: {
            id_image_url: null,
            selfie_url: null,
            gps_lat: gpsLat,
            gps_lng: gpsLng,
            payment_reference: 'WALLET_' + Date.now(),
          },
        });
        if (wErr) throw wErr;
        if (wres && wres.ok === false) throw new Error(wres.error || 'Wallet payment failed');
        setBusy(false);
        Alert.alert('Success ✅', 'Paid ₦2,000 from wallet. You earn ₦500 on approval.');
        router.replace('/home' as any);
        return;
      } catch (e: any) {
        setBusy(false);
        Alert.alert('Wallet payment failed', e.message + '\n\nFalling back to card payment.');
        // fall through to card
      }
    }

    // Card path
    const sess = await supabase.auth.getSession();
    const agentId = sess.data.session?.user?.id || 'unknown';
    setPayRef(newRef(agentId));
  };

  const paystackHTML = () => {
    const email = 'agent.' + (selected?.user_id || 'x').slice(0, 8) + '@gaia.app';
    return [
      "<!DOCTYPE html><html><head><meta charset='utf-8'/>",
      "<script src='https://js.paystack.co/v1/inline.js'></script></head>",
      "<body style='background:#000;margin:0'>",
      "<script>",
      "window.addEventListener('load', function() {",
      "  try {",
      "    var handler = PaystackPop.setup({",
      "      key: '" + PAYSTACK_PUBLIC + "',",
      "      email: '" + email + "',",
      "      amount: " + FEE_KOBO + ",",
      "      currency: 'NGN',",
      "      ref: '" + (payRef || '') + "',",
      "      label: 'GAIA Verification Fee',",
      "      onClose: function() {",
      "        window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'closed' }));",
      "      },",
      "      callback: function(response) {",
      "        window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'success', reference: response.reference }));",
      "      }",
      "    });",
      "    handler.openIframe();",
      "  } catch (err) {",
      "    window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'error', message: String(err) }));",
      "  }",
      "});",
      "</script></body></html>"
    ].join("");
  };

  const onPaystackMessage = async (raw: string) => {
    try {
      const data = JSON.parse(raw);
      if (data.status !== 'success') {
        setPayRef(null);
        if (data.status === 'error') Alert.alert('Payment error', data.message || 'Try again');
        return;
      }
      const reference = data.reference;
      if (!reference || !selected) return;
      setBusy(true);
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      const r = await fetch(API_BASE + '/agent/submit-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          farmer_id: selected.user_id,
          full_name: selected.name,
          phone: null,
          state: null,
          lga: null,
          address: null,
          bvn: null,
          nin: null,
          id_type: null,
          id_number: null,
          crop: crop,
          farm_state: null,
          farm_lga: null,
          farm_size: parseFloat(farmSize) || null,
          id_image_url: null,
          selfie_url: null,
          gps_lat: gpsLat,
          gps_lng: gpsLng,
          payment_reference: reference,
        }),
      });
      const resp = await r.json();
      setBusy(false);
      setPayRef(null);
      if (!r.ok) { Alert.alert('Failed', resp.detail || 'Submit failed'); return; }
      Alert.alert('Success ✅', 'Paid ₦2,000. You earn ₦500 once approved.');
      router.replace('/home' as any);
    } catch (e: any) {
      setBusy(false);
      setPayRef(null);
      Alert.alert('Failed', e.message);
    }
  };

  const filtered = search.trim()
    ? farmers.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : farmers;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={palette.neon} /></View>;
  }

  // ═══════════════════════════════════════════════════════════
  // PICKER
  // ═══════════════════════════════════════════════════════════
  if (!selected) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Verify Farm</Text>
          <Text style={styles.sub}>Pick a farmer registered from REGISTER tab</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search farmer name..." placeholderTextColor={palette.textDim} style={styles.input} autoCapitalize="none" />
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No farmers yet. Register one first.</Text>
          ) : null}
          {filtered.map(f => (
            <Pressable key={f.user_id} onPress={() => setSelected(f)} style={styles.personRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName} numberOfLines={1}>{f.name}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {f.farm_details_complete
                    ? <Text style={styles.badgeOk}>✅ Farm captured</Text>
                    : <Text style={styles.badgeWarn}>⚠️ Farm details pending</Text>}
                  {f.has_polygon ? <Text style={styles.badgeInfo}>🗺️ Polygon</Text> : null}
                  {f.bucket === 'approved' ? <Text style={styles.badgeOk}>✅ Verified</Text> : null}
                  {f.bucket === 'pending' ? <Text style={styles.badgeWarn}>⏳ Pending</Text> : null}
                  {f.bucket === 'rejected' ? <Text style={styles.badgeBad}>❌ Rejected</Text> : null}
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // FARM FORM
  // ═══════════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>CHANGE FARMER</Text></Pressable>
        <Text style={styles.title}>Verify: {selected.name}</Text>
        <Text style={styles.sub}>Capture farm location, photos, and details</Text>

        {selected.farm_details_complete ? (
          <View style={styles.savedBanner}>
            <Text style={styles.savedTxt}>✅ Farm already captured — proceed to payment</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>FARM CATEGORY</Text>
        {['CROPS','LIVESTOCK','WATER','SERVICES'].map(group => (
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
          {FARMER_CATEGORIES[farmerCategory]?.subs.map(sub => (
            <Pressable key={sub} onPress={() => setCrop(sub)} style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: crop === sub ? '#00ff88' : '#222' }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: crop === sub ? '#000' : '#888' }}>{sub}</Text>
            </Pressable>
          ))}
        </View>

        {FARMER_CATEGORIES[farmerCategory]?.countLabel && (
          <>
            <Text style={styles.label}>{FARMER_CATEGORIES[farmerCategory].countLabel?.toUpperCase()}</Text>
            <TextInput value={enterpriseCount} onChangeText={setEnterpriseCount} keyboardType="number-pad" style={styles.input} placeholder="e.g. 25" placeholderTextColor="#888" />
          </>
        )}

        <Text style={styles.sectionLabel}>FARM SIZE & LAND</Text>
        <Text style={styles.label}>FARM SIZE (ACRES) *</Text>
        <TextInput value={farmSize} onChangeText={setFarmSize} keyboardType="numeric" style={styles.input} placeholderTextColor="#888" />
        {farmSize ? <Text style={{ fontSize: 12, fontWeight: '800', color: '#00ff88', marginBottom: 10 }}>{computeFarmScale(parseFloat(farmSize) * 0.4047)}</Text> : null}

        <Text style={styles.label}>PRECISE HECTARES</Text>
        <TextInput value={landAreaHectares} onChangeText={setLandAreaHectares} keyboardType="numeric" style={styles.input} placeholder="From survey" placeholderTextColor="#888" />

        <Text style={styles.label}>LAND TENURE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Owned','Leased','Communal','Cooperative'].map(opt => (
            <Pressable key={opt} onPress={() => setLandTenure(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: landTenure === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: landTenure === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>TITLE DOCUMENT</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['None','C of O','Deed','Survey Plan','Family Land','Leased','Communal'].map(opt => (
            <Pressable key={opt} onPress={() => setTitleType(opt)} style={{ flex: 1, minWidth: '31%', padding: 10, borderRadius: 8, backgroundColor: titleType === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: titleType === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>
        {titleType !== 'None' && (
          <TextInput value={titleNumber} onChangeText={setTitleNumber} style={styles.input} placeholder="Title / Deed Number" placeholderTextColor="#888" />
        )}

        <Text style={styles.label}>ORIENTATION</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Stand Alone','Isolated','Contiguous','Both'].map(opt => (
            <Pressable key={opt} onPress={() => setFarmOrientation(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: farmOrientation === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: farmOrientation === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>PRACTICES</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Crop rotation','Land rotation','Organic','Irrigation'].map(opt => (
            <Pressable key={opt} onPress={() => togglePractice(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: farmingPractices.includes(opt) ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: farmingPractices.includes(opt) ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>FARMING START YEAR</Text>
        <TextInput value={farmingStartYear} onChangeText={setFarmingStartYear} keyboardType="number-pad" maxLength={4} style={styles.input} placeholderTextColor="#888" placeholder="e.g. 2015" />

        <Text style={styles.label}>SEASON</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {['Rainy','Dry','Both'].map(opt => (
            <Pressable key={opt} onPress={() => setFarmingSeason(opt)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: farmingSeason === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: farmingSeason === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>EXPECTED YIELD (KG)</Text>
        <TextInput value={expectedYield} onChangeText={setExpectedYield} keyboardType="numeric" style={styles.input} placeholderTextColor="#888" />

        <Text style={styles.label}>LAST HARVEST (KG)</Text>
        <TextInput value={lastHarvestYield} onChangeText={setLastHarvestYield} keyboardType="numeric" style={styles.input} placeholderTextColor="#888" />

        {isLivestock && (
          <>
            <Text style={styles.sectionLabel}>LIVESTOCK</Text>
            <TextInput value={livestockBreed} onChangeText={setLivestockBreed} style={styles.input} placeholder="Breed" placeholderTextColor="#888" />
            <Text style={styles.label}>VACCINATION</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {['Fully Vaccinated','Partially','Not Vaccinated','Unknown'].map(opt => (
                <Pressable key={opt} onPress={() => setVaccinationStatus(opt)} style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: vaccinationStatus === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: vaccinationStatus === opt ? '#000' : '#888' }}>{opt}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={vetContact} onChangeText={setVetContact} keyboardType="phone-pad" style={styles.input} placeholder="Vet contact" placeholderTextColor="#888" />
            <TextInput value={mortalityLastCycle} onChangeText={setMortalityLastCycle} keyboardType="number-pad" style={styles.input} placeholder="Mortality last cycle (count)" placeholderTextColor="#888" />
          </>
        )}

        <Text style={styles.label}>WATER SOURCE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Rain-fed','Well','Borehole','River','Dam','Irrigation'].map(opt => (
            <Pressable key={opt} onPress={() => setWaterSource(opt)} style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: waterSource === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: waterSource === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>STORAGE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['None','Granary','Warehouse','Cold Storage'].map(opt => (
            <Pressable key={opt} onPress={() => setStorageType(opt)} style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: storageType === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: storageType === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>EQUIPMENT</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Tractor','Plough','Water Pump','Sprayer','Motorcycle','Truck','Hand Tools'].map(opt => (
            <Pressable key={opt} onPress={() => toggleAsset(opt)} style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: assets.includes(opt) ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: assets.includes(opt) ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>GPS & POLYGON</Text>
        <Pressable onPress={captureGps} disabled={gpsBusy} style={[styles.actionBtn, gpsLat && styles.actionBtnOn]}>
          {gpsBusy ? <ActivityIndicator color="#00ff88" /> :
            <Text style={styles.actionBtnTxt}>{gpsLat ? `📍 ${gpsLat.toFixed(5)}, ${gpsLng?.toFixed(5)}` : '📍 CAPTURE FARM GPS *'}</Text>}
        </Pressable>
        <Pressable onPress={() => router.push('/farm-mapping' as any)} style={[styles.actionBtn, { borderColor: '#b388ff' }]}>
          <Text style={[styles.actionBtnTxt, { color: '#b388ff' }]}>🗺️ DRAW FARM POLYGON (NDFR)</Text>
        </Pressable>

        <Text style={styles.label}>{assetName.toUpperCase()} PHOTO *</Text>
        <Pressable onPress={() => pickImage(setAssetPhoto)} style={[styles.photoBtn, assetPhoto && styles.photoBtnFilled]}>
          {assetPhoto
            ? <Image source={{ uri: assetPhoto }} style={{ width: '100%', height: 160, borderRadius: 10 }} />
            : <Text style={styles.photoTxt}>📸 TAKE {assetName.toUpperCase()} PHOTO</Text>}
        </Pressable>

        <View style={styles.feeBox}>
          <Text style={styles.feeLbl}>VERIFICATION FEE</Text>
          <Text style={styles.feeVal}>₦2,000</Text>
          <Text style={styles.feeSub}>Wallet: ₦{walletBalance.toLocaleString()} · earn ₦500 on approval</Text>
        </View>

        <Pressable onPress={completeFarmAndPay} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color="#000" /> :
            <Text style={styles.ctaText}>
              {selected.farm_details_complete ? 'PAY ₦2,000 VERIFICATION FEE' : 'SAVE FARM & PAY ₦2,000'}
            </Text>}
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={!!payRef} animationType="slide" onRequestClose={() => setPayRef(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {payRef ? (
            <WebView originWhitelist={['*']} source={{ html: paystackHTML() }}
              onMessage={(e) => onPaystackMessage(e.nativeEvent.data)}
              javaScriptEnabled domStorageEnabled startInLoadingState
              style={{ flex: 1, backgroundColor: '#000' }} />
          ) : null}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 24, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15, marginBottom: 10 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', padding: 40, fontStyle: 'italic' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  personName: { fontSize: 14, fontWeight: '800', color: p.text },
  badgeOk: { fontSize: 9, fontWeight: '900', color: p.neon },
  badgeWarn: { fontSize: 9, fontWeight: '900', color: '#ffb300' },
  badgeBad: { fontSize: 9, fontWeight: '900', color: '#ff3b5c' },
  badgeInfo: { fontSize: 9, fontWeight: '900', color: '#b388ff' },
  chevron: { fontSize: 22, color: p.textDim },
  savedBanner: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,255,136,0.1)', borderWidth: 1, borderColor: p.neon, marginBottom: 16 },
  savedTxt: { fontSize: 12, fontWeight: '800', color: p.neon },
  actionBtn: { padding: 16, borderRadius: 12, backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 1, borderColor: '#00ff88', alignItems: 'center', marginBottom: 10 },
  actionBtnOn: { backgroundColor: 'rgba(0,255,136,0.2)' },
  actionBtnTxt: { color: '#00ff88', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  photoBtn: { padding: 20, borderRadius: 12, borderWidth: 1.5, borderColor: '#00ff88', borderStyle: 'dashed', alignItems: 'center', marginBottom: 12, backgroundColor: 'rgba(0,255,136,0.05)' },
  photoBtnFilled: { borderStyle: 'solid', padding: 4 },
  photoTxt: { color: '#00ff88', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  feeBox: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)', marginTop: 20, alignItems: 'center' },
  feeLbl: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.textMuted },
  feeVal: { fontSize: 32, fontWeight: '900', color: '#00ff88', marginTop: 4 },
  feeSub: { fontSize: 11, color: p.textMuted, marginTop: 6, textAlign: 'center' },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
