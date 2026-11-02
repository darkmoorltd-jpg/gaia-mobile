import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

const FARMER_CATEGORIES: Record<string, { icon: string; subs: string[]; countLabel?: string; countUnit?: string; group: string }> = {
  // ============ CROPS ============
  'Arable Crops':    { group: 'CROPS', icon: '🌾', subs: ['Maize','Rice','Sorghum','Millet','Cowpea','Soybean','Groundnut','Sesame','Wheat'] },
  'Tree Crops':      { group: 'CROPS', icon: '🌴', subs: ['Cocoa','Oil Palm','Coconut','Cashew','Rubber','Coffee','Kola Nut','Shea'], countLabel: 'Number of Trees', countUnit: 'trees' },
  'Horticulture':    { group: 'CROPS', icon: '🥬', subs: ['Tomato','Pepper','Onion','Cabbage','Lettuce','Carrot','Cucumber','Okra','Spinach','Watermelon'] },
  'Roots & Tubers':  { group: 'CROPS', icon: '🥔', subs: ['Cassava','Yam','Potato','Sweet Potato','Cocoyam','Ginger','Turmeric'] },
  'Cash Crops':      { group: 'CROPS', icon: '💵', subs: ['Cotton','Sugarcane','Tobacco','Jute','Kenaf'] },
  'Agro-Forestry':   { group: 'CROPS', icon: '🌳', subs: ['Teak','Iroko','Mahogany','Bamboo','Eucalyptus','Gmelina','Pine'], countLabel: 'Number of Trees', countUnit: 'trees' },
  'Floriculture':    { group: 'CROPS', icon: '🌺', subs: ['Roses','Lilies','Orchids','Ornamental Plants','Landscaping'] },
  'Medicinal & Herbs': { group: 'CROPS', icon: '🌿', subs: ['Moringa','Bitter Leaf','Gongronema','Neem','Lemon Grass','Aloe Vera','Scent Leaf'] },
  'Mushroom':        { group: 'CROPS', icon: '🍄', subs: ['Oyster Mushroom','Button Mushroom','Shiitake'], countLabel: 'Number of Bags', countUnit: 'bags' },

  // ============ LIVESTOCK ============
  'Cattle':          { group: 'LIVESTOCK', icon: '🐄', subs: ['Beef Cattle','Dairy Cattle','Cattle Fattening','Breeding'], countLabel: 'Number of Cattle', countUnit: 'heads' },
  'Sheep & Goats':   { group: 'LIVESTOCK', icon: '🐐', subs: ['Sheep','Goats','Both'], countLabel: 'Number of Animals', countUnit: 'animals' },
  'Poultry':         { group: 'LIVESTOCK', icon: '🐔', subs: ['Broilers','Layers','Turkeys','Ducks','Guinea Fowl','Hatchery'], countLabel: 'Number of Birds', countUnit: 'birds' },
  'Micro Livestock': { group: 'LIVESTOCK', icon: '🐇', subs: ['Rabbits','Guinea Pigs','Grasscutter'], countLabel: 'Number of Units', countUnit: 'units' },
  'Snailery':        { group: 'LIVESTOCK', icon: '🐌', subs: ['Giant African Snail','Achatina','Archachatina'], countLabel: 'Number of Snails', countUnit: 'snails' },
  'Beekeeping':      { group: 'LIVESTOCK', icon: '🐝', subs: ['Honey Production','Bee Products','Pollination Services'], countLabel: 'Number of Hives', countUnit: 'hives' },
  'Leather/Hides':   { group: 'LIVESTOCK', icon: '🐂', subs: ['Hides','Skins','Processing'] },

  // ============ WATER ============
  'Aquaculture':     { group: 'WATER', icon: '🐟', subs: ['Catfish','Tilapia','Mixed Fish','Hatchery'], countLabel: 'Number of Ponds', countUnit: 'ponds' },
  'Wild Fishery':    { group: 'WATER', icon: '🎣', subs: ['Freshwater','Coastal','Riverine'], countLabel: 'Number of Boats', countUnit: 'boats' },
  'Ornamental Fish': { group: 'WATER', icon: '🐠', subs: ['Aquarium Fish','Koi','Goldfish'], countLabel: 'Number of Tanks', countUnit: 'tanks' },

  // ============ SERVICES ============
  'Pasture':         { group: 'SERVICES', icon: '🌱', subs: ['Natural Pasture','Improved Pasture','Fodder Farm'] },
  'Agro-Processing': { group: 'SERVICES', icon: '🏭', subs: ['Garri Processing','Palm Oil','Rice Milling','Feed Production','Cheese/Dairy','Fruit Juice','Packaging'] },
  'Seed/Nursery':    { group: 'SERVICES', icon: '🌾', subs: ['Seed Production','Seedlings','Grafting','Tissue Culture'] },
  'Hydroponics/Greenhouse': { group: 'SERVICES', icon: '🏠', subs: ['Hydroponics','Greenhouse','Vertical Farming','Aquaponics'] },
  'Palm Wine/Beverage': { group: 'SERVICES', icon: '🍷', subs: ['Palm Wine Tapping','Kunu','Zobo','Local Brewing'] },
  'Compost/Fertilizer': { group: 'SERVICES', icon: '♻️', subs: ['Compost Production','Organic Fertilizer','Biogas','Worm Farming'] },
};

function computeFarmScale(hectares: number): string {
  if (hectares < 1) return 'Subsistence (< 1 Ha)';
  if (hectares < 2) return 'Small (< 2 Ha)';
  if (hectares < 10) return 'Medium (2-10 Ha)';
  if (hectares < 100) return 'Large (10-100 Ha)';
  return 'Commercial (> 100 Ha)';
}

export default function AgentRegister() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  // ---- Basic Info ----
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // ---- Location ----
  const [state, setState] = useState('Kaduna');
  const [lga, setLga] = useState('');
  const [ward, setWard] = useState('');
  
  // ---- Farm Details ----
  const [farmerCategory, setFarmerCategory] = useState('Arable Crops');
  const [crop, setCrop] = useState('Maize');
  const [enterpriseCount, setEnterpriseCount] = useState('');
  const [farmSize, setFarmSize] = useState('1');
  const [landTenure, setLandTenure] = useState('Owned');
  const [farmOrientation, setFarmOrientation] = useState('Stand Alone');
  const [farmingSeason, setFarmingSeason] = useState('Rainy');
  const [farmingPractices, setFarmingPractices] = useState<string[]>([]);

  // ---- NDFR Demographics ----
  const [householdSize, setHouseholdSize] = useState('1');
  const [literacyLevel, setLiteracyLevel] = useState<1|2|3>(3);
  const [educationLevel, setEducationLevel] = useState<0|1|2|3|4>(2);
  const [disability, setDisability] = useState('');
  const [isYouth, setIsYouth] = useState(false);

  // ---- Financial Access ----
  const [hasCredit, setHasCredit] = useState(false);
  const [hasInsurance, setHasInsurance] = useState(false);
  const [receivedSubsidy, setReceivedSubsidy] = useState(false);
  const [otherIncome, setOtherIncome] = useState('');
  const [isAgroDealer, setIsAgroDealer] = useState(false);
  const [processingCompany, setProcessingCompany] = useState('');

  // ---- GPS ----
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  // ---- UI ----
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const togglePractice = (p: string) => {
    setFarmingPractices(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const captureGps = async () => {
    setGpsBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Permission denied'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsLat(loc.coords.latitude);
      setGpsLng(loc.coords.longitude);
    } catch (e: any) {
      Alert.alert('GPS failed', e.message);
    } finally {
      setGpsBusy(false);
    }
  };

  const submit = async () => {
    if (!fullName.trim() || !phone.trim() || !state.trim()) {
      Alert.alert('Missing info', 'Name, phone, and state are required.');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Password required', 'Set a password for the farmer (min 6 characters).');
      return;
    }
    setBusy(true);
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      
      const r = await fetch(API_BASE + '/agent/register-farmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          password: password.trim() || null,
          state: state,
          lga: lga.trim() || null,
          crop: crop,
          farm_size_acres: parseFloat(farmSize) || 1.0,
          gps_lat: gpsLat,
          gps_lng: gpsLng,
        }),
      });
      
      const data = await r.json();
      if (!r.ok) {
        Alert.alert('Failed', data.detail || data.error || ('HTTP ' + r.status));
        setBusy(false);
        return;
      }

      // Link farmer to agent + attach all NDFR fields
      try {
        const { data: { user: me } } = await supabase.auth.getUser();
        if (me && data.farmer_id) {
          await new Promise((r) => setTimeout(r, 400));
          const upd = await supabase
            .from('farmer_registry')
            .update({
              registered_by_agent: me.id,
              household_size: Number(householdSize) || 1,
              literacy_level: literacyLevel,
              education_level: educationLevel,
              disability: disability || null,
              youth: isYouth,
              ward: ward || null,
              farmer_category: farmerCategory,
              farmer_subcategory: crop,
              enterprise_count: enterpriseCount ? Number(enterpriseCount) : null,
              enterprise_unit: enterpriseCount ? (FARMER_CATEGORIES[farmerCategory].countUnit || 'units') : null,
              land_tenure: landTenure,
              farm_orientation: farmOrientation,
              farm_size_scale: computeFarmScale(parseFloat(farmSize) * 0.4047),
              farming_practices: farmingPractices,
              farming_season: farmingSeason,
              has_credit_access: hasCredit,
              has_insurance: hasInsurance,
              received_subsidy: receivedSubsidy,
              other_income_source: otherIncome || null,
              is_agro_dealer: isAgroDealer,
              processing_company: processingCompany || null
            })
            .eq('user_id', data.farmer_id);
          if (upd.error) console.warn('[agent] link failed', upd.error.message);
        }
      } catch (e) {
        console.warn('[agent] link exception', e);
      }

      setResult(data);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.successTitle}>Farmer registered</Text>
          <View style={styles.successCard}>
            <Text style={styles.successLbl}>PHONE</Text>
            <Text style={styles.successVal}>{result.phone}</Text>
            <Text style={styles.successLbl}>TEMPORARY PASSWORD</Text>
            <Text style={styles.successVal}>{result.temp_password}</Text>
            <Text style={styles.successLbl}>EMAIL</Text>
            <Text style={styles.successVal}>{result.email}</Text>
          </View>
          <Pressable onPress={() => { setResult(null); setFullName(''); setPhone(''); setEmail(''); setPassword(''); }} style={styles.cta}>
            <Text style={styles.ctaText}>REGISTER ANOTHER FARMER</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={[styles.cta, { backgroundColor: '#333', marginTop: 12 }]}>
            <Text style={styles.ctaText}>BACK TO AGENT HOME</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Register Farmer</Text>
        <Text style={styles.sub}>NDFR-Compliant Onboarding</Text>

        <Text style={styles.sectionLabel}>1. PERSONAL INFORMATION</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholder="Full Name *" placeholderTextColor="#888" />
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholder="Phone Number *" placeholderTextColor="#888" />
        <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} placeholder="Email (optional)" placeholderTextColor="#888" />
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="Temporary Password *" placeholderTextColor="#888" />

        <Text style={styles.sectionLabel}>2. LOCATION</Text>
        <TextInput value={lga} onChangeText={setLga} style={styles.input} placeholder="LGA *" placeholderTextColor="#888" />
        <TextInput value={ward} onChangeText={setWard} style={styles.input} placeholder="Ward (Sub-LGA)" placeholderTextColor="#888" />

        <Text style={styles.sectionLabel}>3. FARMER CATEGORY</Text>
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

        <Text style={styles.sectionLabel}>4. PRIMARY ENTERPRISE</Text>
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

        <Text style={styles.sectionLabel}>5. FARM DETAILS</Text>
        <Text style={styles.label}>FARM SIZE (ACRES)</Text>
        <TextInput value={farmSize} onChangeText={setFarmSize} keyboardType="numeric" style={styles.input} placeholderTextColor="#888" />
        <Text style={styles.label}>AUTO-SCALE</Text>
        <View style={{ backgroundColor: 'rgba(0,255,136,0.1)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#00ff88', marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#00ff88' }}>{computeFarmScale(parseFloat(farmSize) * 0.4047)}</Text>
        </View>

        <Pressable onPress={captureGps} disabled={gpsBusy} style={[styles.cta, { backgroundColor: gpsLat ? 'rgba(0,255,136,0.2)' : '#222', borderWidth: 1, borderColor: '#00ff88', marginTop: 0 }]}>
          {gpsBusy ? <ActivityIndicator color="#00ff88" /> : <Text style={{ color: '#00ff88', fontWeight: '900' }}>{gpsLat ? '✅ GPS CAPTURED' : '📍 PIN GPS COORDINATES'}</Text>}
        </Pressable>

        <Text style={styles.label}>LAND TENURE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Owned', 'Leased', 'Communal', 'Cooperative'].map(opt => (
            <Pressable key={opt} onPress={() => setLandTenure(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: landTenure === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: landTenure === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>FARM ORIENTATION</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Stand Alone', 'Isolated', 'Contiguous', 'Both'].map(opt => (
            <Pressable key={opt} onPress={() => setFarmOrientation(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: farmOrientation === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: farmOrientation === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>FARMING PRACTICES</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Crop rotation', 'Land rotation', 'Organic farming', 'Irrigation farming'].map(opt => (
            <Pressable key={opt} onPress={() => togglePractice(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: farmingPractices.includes(opt) ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: farmingPractices.includes(opt) ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>FARMING SEASON</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {['Rainy', 'Dry', 'Both'].map(opt => (
            <Pressable key={opt} onPress={() => setFarmingSeason(opt)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: farmingSeason === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: farmingSeason === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>6. HOUSEHOLD</Text>
        <TextInput value={householdSize} onChangeText={setHouseholdSize} keyboardType="number-pad" style={styles.input} placeholder="Household Size" placeholderTextColor="#888" />

        <Text style={styles.label}>LITERACY LEVEL</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {[{ val: 1, label: '1 - Illiterate' },{ val: 2, label: '2 - Semi' },{ val: 3, label: '3 - Literate' }].map(opt => (
            <Pressable key={opt.val} onPress={() => setLiteracyLevel(opt.val as 1|2|3)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: literacyLevel === opt.val ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: literacyLevel === opt.val ? '#000' : '#888' }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>EDUCATION LEVEL</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {[{ val: 0, label: '0 - None' },{ val: 1, label: '1 - Primary' },{ val: 2, label: '2 - Secondary' },{ val: 3, label: '3 - Tertiary' },{ val: 4, label: '4 - Other' }].map(opt => (
            <Pressable key={opt.val} onPress={() => setEducationLevel(opt.val as 0|1|2|3|4)} style={{ width: '31%', padding: 12, borderRadius: 8, backgroundColor: educationLevel === opt.val ? '#00ff88' : '#222', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: educationLevel === opt.val ? '#000' : '#888' }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>DISABILITY (Optional)</Text>
        <TextInput value={disability} onChangeText={setDisability} style={styles.input} placeholder="e.g. Visual impairment" placeholderTextColor="#888" />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Youth (Under 35)</Text>
            <Text style={{ fontSize: 11, color: '#888' }}>Check if the farmer is a youth.</Text>
          </View>
          <Pressable onPress={() => setIsYouth(!isYouth)} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: isYouth ? '#00ff88' : '#333', justifyContent: 'center', paddingHorizontal: 3 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: isYouth ? 'flex-end' : 'flex-start' }} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>7. FINANCIAL ACCESS</Text>
        <View style={{ gap: 6, marginBottom: 12 }}>
          {[
            { label: 'Has ever received agricultural credit', val: hasCredit, set: setHasCredit },
            { label: 'Has agricultural insurance', val: hasInsurance, set: setHasInsurance },
            { label: 'Has received government subsidy', val: receivedSubsidy, set: setReceivedSubsidy },
            { label: 'Is an approved agro-dealer', val: isAgroDealer, set: setIsAgroDealer }
          ].map((item, i) => (
            <Pressable key={i} onPress={() => item.set(!item.val)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, backgroundColor: item.val ? 'rgba(0,255,136,0.1)' : '#222', borderWidth: 1, borderColor: item.val ? '#00ff88' : '#333' }}>
              <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: item.val ? '#00ff88' : 'transparent', borderWidth: 2, borderColor: item.val ? '#00ff88' : '#666', alignItems: 'center', justifyContent: 'center' }}>
                {item.val ? <Text style={{ fontSize: 12, fontWeight: '900', color: '#000' }}>✓</Text> : null}
              </View>
              <Text style={{ fontSize: 13, color: '#fff', flex: 1 }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>OTHER SOURCE OF INCOME</Text>
        <TextInput value={otherIncome} onChangeText={setOtherIncome} style={styles.input} placeholder="e.g. Trading, Teaching, None" placeholderTextColor="#888" />

        <Text style={styles.label}>PROCESSING COMPANY AFFILIATION (Optional)</Text>
        <TextInput value={processingCompany} onChangeText={setProcessingCompany} style={styles.input} placeholder="e.g. Olam, Flour Mills" placeholderTextColor="#888" />

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>REGISTER FARMER</Text>}
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 24, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15, marginBottom: 10 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  successTitle: { fontSize: 26, fontWeight: '900', color: p.text, marginBottom: 20, textAlign: 'center', marginTop: 20 },
  successCard: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 20 },
  successLbl: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginTop: 8 },
  successVal: { fontSize: 18, fontWeight: '900', color: p.text, marginTop: 4 },
});
