import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { enqueueScan } from '../../src/utils/offlineQueue';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

const FARMER_CATEGORIES: Record<string, { icon: string; subs: string[]; countLabel?: string; countUnit?: string; group: string; assetName: string; isLivestock?: boolean }> = {
  'Arable Crops':    { group: 'CROPS', icon: '🌾', subs: ['Maize','Rice','Sorghum','Millet','Cowpea','Soybean','Groundnut','Sesame','Wheat'], assetName: 'Crop Field' },
  'Tree Crops':      { group: 'CROPS', icon: '🌴', subs: ['Cocoa','Oil Palm','Coconut','Cashew','Rubber','Coffee','Kola Nut','Shea'], countLabel: 'Number of Trees', countUnit: 'trees', assetName: 'Tree Plantation' },
  'Horticulture':    { group: 'CROPS', icon: '🥬', subs: ['Tomato','Pepper','Onion','Cabbage','Lettuce','Carrot','Cucumber','Okra','Spinach','Watermelon'], assetName: 'Vegetable Garden' },
  'Roots & Tubers':  { group: 'CROPS', icon: '🥔', subs: ['Cassava','Yam','Potato','Sweet Potato','Cocoyam','Ginger','Turmeric'], assetName: 'Roots Field' },
  'Cash Crops':      { group: 'CROPS', icon: '💵', subs: ['Cotton','Sugarcane','Tobacco','Jute','Kenaf'], assetName: 'Cash Crop Field' },
  'Agro-Forestry':   { group: 'CROPS', icon: '🌳', subs: ['Teak','Iroko','Mahogany','Bamboo','Eucalyptus','Gmelina','Pine'], countLabel: 'Number of Trees', countUnit: 'trees', assetName: 'Forest Plot' },
  'Floriculture':    { group: 'CROPS', icon: '🌺', subs: ['Roses','Lilies','Orchids','Ornamental Plants','Landscaping'], assetName: 'Flower Garden' },
  'Medicinal & Herbs': { group: 'CROPS', icon: '🌿', subs: ['Moringa','Bitter Leaf','Gongronema','Neem','Lemon Grass','Aloe Vera','Scent Leaf'], assetName: 'Herb Farm' },
  'Mushroom':        { group: 'CROPS', icon: '🍄', subs: ['Oyster Mushroom','Button Mushroom','Shiitake'], countLabel: 'Number of Bags', countUnit: 'bags', assetName: 'Mushroom Farm' },
  'Cattle':          { group: 'LIVESTOCK', icon: '🐄', subs: ['Beef Cattle','Dairy Cattle','Cattle Fattening','Breeding'], countLabel: 'Number of Cattle', countUnit: 'heads', assetName: 'Cattle Ranch', isLivestock: true },
  'Sheep & Goats':   { group: 'LIVESTOCK', icon: '🐐', subs: ['Sheep','Goats','Both'], countLabel: 'Number of Animals', countUnit: 'animals', assetName: 'Sheep/Goat Pen', isLivestock: true },
  'Poultry':         { group: 'LIVESTOCK', icon: '🐔', subs: ['Broilers','Layers','Turkeys','Ducks','Guinea Fowl','Hatchery'], countLabel: 'Number of Birds', countUnit: 'birds', assetName: 'Poultry House', isLivestock: true },
  'Micro Livestock': { group: 'LIVESTOCK', icon: '🐇', subs: ['Rabbits','Guinea Pigs','Grasscutter'], countLabel: 'Number of Units', countUnit: 'units', assetName: 'Micro Livestock Pen', isLivestock: true },
  'Snailery':        { group: 'LIVESTOCK', icon: '🐌', subs: ['Giant African Snail','Achatina','Archachatina'], countLabel: 'Number of Snails', countUnit: 'snails', assetName: 'Snail Farm', isLivestock: true },
  'Beekeeping':      { group: 'LIVESTOCK', icon: '🐝', subs: ['Honey Production','Bee Products','Pollination Services'], countLabel: 'Number of Hives', countUnit: 'hives', assetName: 'Apiary (Beehives)', isLivestock: true },
  'Leather/Hides':   { group: 'LIVESTOCK', icon: '🐂', subs: ['Hides','Skins','Processing'], assetName: 'Leather Workshop' },
  'Aquaculture':     { group: 'WATER', icon: '🐟', subs: ['Catfish','Tilapia','Mixed Fish','Hatchery'], countLabel: 'Number of Ponds', countUnit: 'ponds', assetName: 'Fish Pond', isLivestock: true },
  'Wild Fishery':    { group: 'WATER', icon: '🎣', subs: ['Freshwater','Coastal','Riverine'], countLabel: 'Number of Boats', countUnit: 'boats', assetName: 'Fishing Site' },
  'Ornamental Fish': { group: 'WATER', icon: '🐠', subs: ['Aquarium Fish','Koi','Goldfish'], countLabel: 'Number of Tanks', countUnit: 'tanks', assetName: 'Fish Tanks' },
  'Pasture':         { group: 'SERVICES', icon: '🌱', subs: ['Natural Pasture','Improved Pasture','Fodder Farm'], assetName: 'Pasture Land' },
  'Agro-Processing': { group: 'SERVICES', icon: '🏭', subs: ['Garri Processing','Palm Oil','Rice Milling','Feed Production','Cheese/Dairy','Fruit Juice','Packaging'], assetName: 'Processing Facility' },
  'Seed/Nursery':    { group: 'SERVICES', icon: '🌾', subs: ['Seed Production','Seedlings','Grafting','Tissue Culture'], assetName: 'Nursery' },
  'Hydroponics/Greenhouse': { group: 'SERVICES', icon: '🏠', subs: ['Hydroponics','Greenhouse','Vertical Farming','Aquaponics'], assetName: 'Greenhouse' },
  'Palm Wine/Beverage': { group: 'SERVICES', icon: '🍷', subs: ['Palm Wine Tapping','Kunu','Zobo','Local Brewing'], assetName: 'Brewery/Tapping Site' },
  'Compost/Fertilizer': { group: 'SERVICES', icon: '♻️', subs: ['Compost Production','Organic Fertilizer','Biogas','Worm Farming'], assetName: 'Compost Site' },
  'Logistics/Transporter': { group: 'SERVICES', icon: '🚛', subs: ['Cold Truck','Dry Truck','Motorcycle (Keke)','Tricycle','Boat'], assetName: 'Vehicle' },
  'Cooperative/Association': { group: 'SERVICES', icon: '🤝', subs: ['Crop Coop','Livestock Coop','Fisheries Coop','Mixed Coop'], countLabel: 'Number of Members', countUnit: 'members', assetName: 'Meeting Hall' },
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

  // Core
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [stateName, setStateName] = useState('Kaduna');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lga, setLga] = useState('');
  const [ward, setWard] = useState('');

  // Category
  const [farmerCategory, setFarmerCategory] = useState('Arable Crops');
  const [crop, setCrop] = useState('Maize');
  const [enterpriseCount, setEnterpriseCount] = useState('');

  // Farm
  const [farmSize, setFarmSize] = useState('1');
  const [landTenure, setLandTenure] = useState('Owned');
  const [farmOrientation, setFarmOrientation] = useState('Stand Alone');
  const [farmingSeason, setFarmingSeason] = useState('Rainy');
  const [farmingPractices, setFarmingPractices] = useState<string[]>([]);
  const [farmingStartYear, setFarmingStartYear] = useState('');

  // Land documentation
  const [titleType, setTitleType] = useState('None');
  const [titleNumber, setTitleNumber] = useState('');
  const [landAreaHectares, setLandAreaHectares] = useState('');

  // Livestock
  const [livestockBreed, setLivestockBreed] = useState('');
  const [vaccinationStatus, setVaccinationStatus] = useState('Not Vaccinated');
  const [vetContact, setVetContact] = useState('');
  const [mortalityLastCycle, setMortalityLastCycle] = useState('');

  // Production
  const [currentSeason, setCurrentSeason] = useState('2025 Rainy');
  const [expectedYield, setExpectedYield] = useState('');
  const [lastHarvestYield, setLastHarvestYield] = useState('');

  // Household & demographics
  const [householdSize, setHouseholdSize] = useState('1');
  const [literacyLevel, setLiteracyLevel] = useState<1|2|3>(3);
  const [educationLevel, setEducationLevel] = useState<0|1|2|3|4>(2);
  const [disability, setDisability] = useState('');
  const [isYouth, setIsYouth] = useState(false);
  const [vulnerability, setVulnerability] = useState<string[]>([]);

  // Financial
  const [hasCredit, setHasCredit] = useState(false);
  const [hasInsurance, setHasInsurance] = useState(false);
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  const [receivedSubsidy, setReceivedSubsidy] = useState(false);
  const [otherIncome, setOtherIncome] = useState('');
  const [isAgroDealer, setIsAgroDealer] = useState(false);

  // Business
  const [businessName, setBusinessName] = useState('');
  const [cacNumber, setCacNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [processingCapacity, setProcessingCapacity] = useState('');
  const [dealerInputTypes, setDealerInputTypes] = useState<string[]>([]);
  const [processingCompany, setProcessingCompany] = useState('');

  // Assets
  const [assets, setAssets] = useState<string[]>([]);
  const [waterSource, setWaterSource] = useState('Rain-fed Only');
  const [storageType, setStorageType] = useState('None');

  // Cooperative
  const [isCoopMember, setIsCoopMember] = useState(false);
  const [coopName, setCoopName] = useState('');
  const [coopRole, setCoopRole] = useState('Member');
  const [coopJoinedYear, setCoopJoinedYear] = useState('');

  // Banking
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState('');
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');

  // Market
  const [sellsTo, setSellsTo] = useState<string[]>([]);
  const [hasContractFarming, setHasContractFarming] = useState(false);
  const [contractBuyer, setContractBuyer] = useState('');

  // Inputs
  const [fertilizerBrand, setFertilizerBrand] = useState('');
  const [fertilizerKg, setFertilizerKg] = useState('');
  const [seedSource, setSeedSource] = useState('Own Saved');
  const [pesticideUsage, setPesticideUsage] = useState('None');

  // Photos
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [assetPhoto, setAssetPhoto] = useState<string | null>(null);
  const [portraitPhoto, setPortraitPhoto] = useState<string | null>(null);
  const [idPhoto, setIdPhoto] = useState<string | null>(null);

  // UI
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [ndpaConsent, setNdpaConsent] = useState(false);
  const [nin, setNin] = useState('');
  const [ninVerified, setNinVerified] = useState(false);
  const [verifyingNin, setVerifyingNin] = useState(false);

  const toggleAsset = (a: string) => setAssets(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const togglePractice = (p: string) => setFarmingPractices(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const toggleVulnerability = (v: string) => setVulnerability(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  const toggleInputType = (v: string) => setDealerInputTypes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  const toggleSellsTo = (v: string) => setSellsTo(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const isBusiness = ['Agro-Processing', 'Seed/Nursery', 'Compost/Fertilizer', 'Logistics/Transporter', 'Cooperative/Association'].includes(farmerCategory) || isAgroDealer;
  const isLivestock = FARMER_CATEGORIES[farmerCategory].isLivestock === true;

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

  const pickPhoto = async (setter: (v: string) => void) => {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (!r.canceled) setter(r.assets[0].uri);
  };

  const uploadPhoto = async (uri: string, farmerId: string, folder: string): Promise<string | null> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const path = farmerId + '/' + folder + '-' + Date.now() + '.jpg';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error } = await supabase.storage.from('farmer-assets').upload(path, bytes.buffer, { contentType: 'image/jpeg' });
      if (error) return null;
      return supabase.storage.from('farmer-assets').getPublicUrl(path).data.publicUrl;
    } catch { return null; }
  };

  const verifyNIN = async () => {
    if (!nin || nin.length < 11) { Alert.alert('Invalid NIN', 'NIN must be 11 digits'); return; }
    setVerifyingNin(true);
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      const res = await fetch(API_BASE + '/verify-nin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ nin, first_name: fullName.split(' ')[0], last_name: fullName.split(' ')[1] || '' })
      });
      const data = await res.json();
      if (data.verified) {
        setNinVerified(true);
        Alert.alert('Success', 'NIN Verified against NIMC records.');
      } else {
        Alert.alert('Failed', 'Could not verify NIN');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setVerifyingNin(false);
    }
  };

  const submit = async () => {
    if (!fullName.trim() || !phone.trim()) { Alert.alert('Missing', 'Name and phone required.'); return; }
    if (!password || password.length < 6) { Alert.alert('Password', 'Min 6 characters.'); return; }
    if (!assetPhoto) { Alert.alert('Asset Photo Required', 'Take a photo of the ' + FARMER_CATEGORIES[farmerCategory].assetName); return; }
    if (!ndpaConsent) { Alert.alert('Consent Required', 'You must check the NDPA consent box to proceed.'); return; }

    setBusy(true);
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      await enqueueScan({ type: 'farmer_registration', payload: { fullName, phone, nin, stateName, lga, crop, farmSize, gpsLat, gpsLng, ndpaConsent } });
      Alert.alert('Saved Offline', 'No network. Farmer data saved locally and will sync automatically.');
      setBusy(false);
      return;
    }
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const r = await fetch(API_BASE + '/agent/register-farmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          full_name: fullName.trim(), phone: phone.trim(),
          email: email.trim() || null, password: password.trim() || null,
          state: stateName.trim(), lga: lga.trim() || null, crop: crop,
          farm_size_acres: parseFloat(farmSize) || 1.0,
          gps_lat: gpsLat, gps_lng: gpsLng,
        }),
      });
      const data = await r.json();
      if (!r.ok) { Alert.alert('Failed', data.detail || data.error || 'HTTP ' + r.status); setBusy(false); return; }

      try {
        const { data: { user: me } } = await supabase.auth.getUser();
        if (me && data.farmer_id) {
          await new Promise((res) => setTimeout(res, 400));
          const [assetUrl, portraitUrl, idUrl] = await Promise.all([
            uploadPhoto(assetPhoto, data.farmer_id, 'asset'),
            portraitPhoto ? uploadPhoto(portraitPhoto, data.farmer_id, 'portrait') : Promise.resolve(null),
            idPhoto ? uploadPhoto(idPhoto, data.farmer_id, 'id') : Promise.resolve(null),
          ]);

          await supabase.from('farmer_registry').update({
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
            farming_start_year: farmingStartYear ? Number(farmingStartYear) : null,
            title_type: titleType !== 'None' ? titleType : null,
            title_number: titleNumber || null,
            land_area_hectares: landAreaHectares ? Number(landAreaHectares) : null,
            livestock_breed: livestockBreed || null,
            vaccination_status: isLivestock ? vaccinationStatus : null,
            vet_contact: vetContact || null,
            mortality_last_cycle: mortalityLastCycle ? Number(mortalityLastCycle) : null,
            current_season: currentSeason,
            expected_yield_kg: expectedYield ? Number(expectedYield) : null,
            last_harvest_yield_kg: lastHarvestYield ? Number(lastHarvestYield) : null,
            sells_to: sellsTo.length > 0 ? sellsTo : null,
            has_contract_farming: hasContractFarming,
            contract_buyer: contractBuyer || null,
            fertilizer_brand: fertilizerBrand || null,
            fertilizer_kg_per_season: fertilizerKg ? Number(fertilizerKg) : null,
            seed_source: seedSource,
            pesticide_usage: pesticideUsage,
            has_credit_access: hasCredit,
            has_insurance: hasInsurance,
            insurance_provider: hasInsurance ? insuranceProvider || null : null,
            insurance_policy_number: hasInsurance ? insurancePolicy || null : null,
            received_subsidy: receivedSubsidy,
            other_income_source: otherIncome || null,
            is_agro_dealer: isAgroDealer,
            processing_company: processingCompany || null,
            business_name: businessName || null,
            cac_number: cacNumber || null,
            license_number: licenseNumber || null,
            business_address: businessAddress || null,
            dealer_input_types: dealerInputTypes.length > 0 ? dealerInputTypes : null,
            processing_capacity_tonnes: processingCapacity ? Number(processingCapacity) : null,
            farm_assets: assets.length > 0 ? assets : null,
            water_source: waterSource,
            storage_type: storageType,
            is_coop_member: isCoopMember,
            coop_name: isCoopMember ? coopName || null : null,
            coop_role: isCoopMember ? coopRole : null,
            coop_joined_year: isCoopMember && coopJoinedYear ? Number(coopJoinedYear) : null,
            bank_name: bankName || null,
            bank_account_name: bankAccountName || null,
            bank_account_number: bankAccountNumber || null,
            mobile_money_provider: mobileMoneyProvider || null,
            mobile_money_number: mobileMoneyNumber || null,
            vulnerability_status: vulnerability.length > 0 ? vulnerability : null,
            asset_photo_url: assetUrl,
            farmer_portrait_url: portraitUrl,
            id_document_url: idUrl,
            ndpa_consent: true,
            nin: nin,
            nin_verified: ninVerified,
            ndpa_consent_at: new Date().toISOString(),
          }).eq('user_id', data.farmer_id);

          // ---- MIRROR TO user_profiles (so admin + Dr. Vinc + marketplace see it) ----
          await supabase.from('user_profiles').update({
            phone: phone.trim(),
            state: stateName.trim(),
            lga: lga.trim() || null,
            ward: ward || null,
            primary_crops: crop,
            farming_type: farmingSeason,
            farm_size_acres: parseFloat(farmSize) || 1.0,
            years_experience: farmingStartYear ? (new Date().getFullYear() - Number(farmingStartYear)) : 0,
            account_name: bankAccountName || null,
            account_number: bankAccountNumber || null,
            bank_name: bankName || null,
            emergency_contact_name: null,
            registered_by_agent: me.id,
            farmer_registry_id: data.farmer_id,
            farmer_category: farmerCategory,
            farmer_subcategory: crop,
            household_size: Number(householdSize) || 1,
            literacy_level: literacyLevel,
            education_level: educationLevel,
            disability: disability || null,
            youth: isYouth,
            enterprise_count: enterpriseCount ? Number(enterpriseCount) : null,
            enterprise_unit: enterpriseCount ? (FARMER_CATEGORIES[farmerCategory].countUnit || 'units') : null,
            land_tenure: landTenure,
            farm_orientation: farmOrientation,
            farm_size_scale: computeFarmScale(parseFloat(farmSize) * 0.4047),
            farming_practices: farmingPractices.length > 0 ? farmingPractices : null,
            farming_season: farmingSeason,
            farming_start_year: farmingStartYear ? Number(farmingStartYear) : null,
            title_type: titleType !== 'None' ? titleType : null,
            title_number: titleNumber || null,
            land_area_hectares: landAreaHectares ? Number(landAreaHectares) : null,
            livestock_breed: livestockBreed || null,
            vaccination_status: isLivestock ? vaccinationStatus : null,
            vet_contact: vetContact || null,
            mortality_last_cycle: mortalityLastCycle ? Number(mortalityLastCycle) : null,
            current_season: currentSeason,
            expected_yield_kg: expectedYield ? Number(expectedYield) : null,
            last_harvest_yield_kg: lastHarvestYield ? Number(lastHarvestYield) : null,
            sells_to: sellsTo.length > 0 ? sellsTo : null,
            has_contract_farming: hasContractFarming,
            contract_buyer: contractBuyer || null,
            fertilizer_brand: fertilizerBrand || null,
            fertilizer_kg_per_season: fertilizerKg ? Number(fertilizerKg) : null,
            seed_source: seedSource,
            pesticide_usage: pesticideUsage,
            has_credit_access: hasCredit,
            has_insurance: hasInsurance,
            insurance_provider: hasInsurance ? insuranceProvider || null : null,
            insurance_policy_number: hasInsurance ? insurancePolicy || null : null,
            received_subsidy: receivedSubsidy,
            other_income_source: otherIncome || null,
            is_agro_dealer: isAgroDealer,
            processing_company: processingCompany || null,
            business_name: businessName || null,
            cac_number: cacNumber || null,
            license_number: licenseNumber || null,
            business_address: businessAddress || null,
            dealer_input_types: dealerInputTypes.length > 0 ? dealerInputTypes : null,
            processing_capacity_tonnes: processingCapacity ? Number(processingCapacity) : null,
            farm_assets: assets.length > 0 ? assets : null,
            water_source: waterSource,
            storage_type: storageType,
            is_coop_member: isCoopMember,
            coop_name: isCoopMember ? coopName || null : null,
            coop_role: isCoopMember ? coopRole : null,
            coop_joined_year: isCoopMember && coopJoinedYear ? Number(coopJoinedYear) : null,
            mobile_money_provider: mobileMoneyProvider || null,
            mobile_money_number: mobileMoneyNumber || null,
            vulnerability_status: vulnerability.length > 0 ? vulnerability : null,
            asset_photo_url: assetUrl,
            farmer_portrait_url: portraitUrl,
            id_document_url: idUrl,
            ndfr_complete: true,
            ndpa_consent: true,
            ndpa_consent_at: new Date().toISOString(),
          }).eq('user_id', data.farmer_id);
        }
      } catch (e) { console.warn('link failed', e); }

      setResult(data);
    } catch (e: any) { Alert.alert('Failed', e.message); }
    finally { setBusy(false); }
  };

  if (result) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.successTitle}>Farmer Registered ✅</Text>
          <View style={styles.successCard}>
            <Text style={styles.successLbl}>PHONE</Text>
            <Text style={styles.successVal}>{result.phone}</Text>
            <Text style={styles.successLbl}>TEMP PASSWORD</Text>
            <Text style={styles.successVal}>{result.temp_password}</Text>
          </View>
          <Pressable onPress={() => { setResult(null); setFullName(''); setPhone(''); setEmail(''); setPassword(''); setAssetPhoto(null); setPortraitPhoto(null); setIdPhoto(null); setGpsLat(null); setGpsLng(null); }} style={styles.cta}>
            <Text style={styles.ctaText}>REGISTER ANOTHER</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={[styles.cta, { backgroundColor: '#333', marginTop: 12 }]}>
            <Text style={styles.ctaText}>BACK TO HOME</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const assetName = FARMER_CATEGORIES[farmerCategory].assetName;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Register Farmer</Text>
        <Text style={styles.sub}>Complete NDFR Onboarding</Text>

        <Text style={styles.sectionLabel}>1. PERSONAL</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholder="Full Name *" placeholderTextColor="#888" />
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholder="Phone *" placeholderTextColor="#888" />
        <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} placeholder="Email (optional)" placeholderTextColor="#888" />
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="Password *" placeholderTextColor="#888" />
        <TextInput value={stateName} onChangeText={setStateName} style={styles.input} placeholder="State *" placeholderTextColor="#888" />
        <TextInput value={lga} onChangeText={setLga} style={styles.input} placeholder="LGA *" placeholderTextColor="#888" />
        <TextInput value={ward} onChangeText={setWard} style={styles.input} placeholder="Ward (Sub-LGA)" placeholderTextColor="#888" />

        <Text style={styles.sectionLabel}>1B. IDENTITY & NIN</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <TextInput value={nin} onChangeText={setNin} keyboardType="number-pad" maxLength={11} style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="11-digit NIN" placeholderTextColor="#888" />
          <Pressable onPress={verifyNIN} disabled={verifyingNin || ninVerified} style={{ backgroundColor: ninVerified ? 'rgba(0,255,136,0.2)' : '#222', borderWidth: 1, borderColor: '#00ff88', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12 }}>
            {verifyingNin ? <ActivityIndicator color="#00ff88" /> : <Text style={{ color: '#00ff88', fontWeight: '900' }}>{ninVerified ? '✅ VERIFIED' : 'VERIFY'}</Text>}
          </Pressable>
        </View>

<Text style={styles.sectionLabel}>2. CATEGORY</Text>
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

        <Text style={styles.sectionLabel}>3. FARM SIZE & LAND</Text>
        <TextInput value={farmSize} onChangeText={setFarmSize} keyboardType="numeric" style={styles.input} placeholder="Acres" placeholderTextColor="#888" />
        <Text style={{ fontSize: 12, fontWeight: '800', color: '#00ff88', marginBottom: 10 }}>{computeFarmScale(parseFloat(farmSize) * 0.4047)}</Text>
        <TextInput value={landAreaHectares} onChangeText={setLandAreaHectares} keyboardType="numeric" style={styles.input} placeholder="Precise hectares (survey)" placeholderTextColor="#888" />

        <Text style={styles.label}>TITLE DOCUMENT</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['None','C of O','Deed of Assignment','Survey Plan','Family Land','Leased','Communal'].map(opt => (
            <Pressable key={opt} onPress={() => setTitleType(opt)} style={{ flex: 1, minWidth: '31%', padding: 10, borderRadius: 8, backgroundColor: titleType === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: titleType === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>
        {titleType !== 'None' && (
          <TextInput value={titleNumber} onChangeText={setTitleNumber} style={styles.input} placeholder="Title / Deed Number" placeholderTextColor="#888" />
        )}

        <Text style={styles.label}>LAND TENURE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Owned','Leased','Communal','Cooperative'].map(opt => (
            <Pressable key={opt} onPress={() => setLandTenure(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: landTenure === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: landTenure === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>4. {assetName.toUpperCase()} LOCATION & PHOTO</Text>
        <Pressable onPress={captureGps} disabled={gpsBusy} style={[styles.cta, { backgroundColor: gpsLat ? 'rgba(0,255,136,0.2)' : '#222', borderWidth: 1, borderColor: '#00ff88', marginTop: 0, marginBottom: 10 }]}>
          {gpsBusy ? <ActivityIndicator color="#00ff88" /> : <Text style={{ color: '#00ff88', fontWeight: '900' }}>{gpsLat ? '✅ GPS CAPTURED' : '📍 PIN ' + assetName.toUpperCase() + ' GPS'}</Text>}
        </Pressable>

        <Pressable onPress={() => router.push('/farm-mapping' as any)} style={[styles.cta, { backgroundColor: '#222', borderWidth: 1, borderColor: '#b388ff', marginTop: 0, marginBottom: 10 }]}>
          <Text style={{ color: '#b388ff', fontWeight: '900' }}>🗺️ DRAW FARM POLYGON (NDFR)</Text>
        </Pressable>

        <Pressable onPress={() => pickPhoto(setAssetPhoto)} style={[styles.cta, { backgroundColor: assetPhoto ? 'rgba(0,255,136,0.2)' : '#222', borderWidth: 1, borderColor: '#00ff88', marginTop: 0, marginBottom: 10 }]}>
          <Text style={{ color: '#00ff88', fontWeight: '900' }}>{assetPhoto ? '✅ ASSET PHOTO' : '📸 TAKE ' + assetName.toUpperCase() + ' PHOTO *'}</Text>
        </Pressable>
        {assetPhoto ? <Image source={{ uri: assetPhoto }} style={{ width: '100%', height: 150, borderRadius: 10, marginBottom: 10 }} /> : null}

        <Pressable onPress={() => pickPhoto(setPortraitPhoto)} style={[styles.cta, { backgroundColor: portraitPhoto ? 'rgba(0,255,136,0.2)' : '#222', borderWidth: 1, borderColor: '#00ff88', marginTop: 0, marginBottom: 10 }]}>
          <Text style={{ color: '#00ff88', fontWeight: '900' }}>{portraitPhoto ? '✅ FARMER PORTRAIT' : '📸 FARMER PORTRAIT (face)'}</Text>
        </Pressable>
        {portraitPhoto ? <Image source={{ uri: portraitPhoto }} style={{ width: '100%', height: 150, borderRadius: 10, marginBottom: 10 }} /> : null}

        <Pressable onPress={() => pickPhoto(setIdPhoto)} style={[styles.cta, { backgroundColor: idPhoto ? 'rgba(0,255,136,0.2)' : '#222', borderWidth: 1, borderColor: '#00ff88', marginTop: 0, marginBottom: 10 }]}>
          <Text style={{ color: '#00ff88', fontWeight: '900' }}>{idPhoto ? '✅ ID DOCUMENT' : '📸 ID DOCUMENT PHOTO'}</Text>
        </Pressable>
        {idPhoto ? <Image source={{ uri: idPhoto }} style={{ width: '100%', height: 150, borderRadius: 10, marginBottom: 10 }} /> : null}

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
          {['Crop rotation','Land rotation','Organic farming','Irrigation farming'].map(opt => (
            <Pressable key={opt} onPress={() => togglePractice(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: farmingPractices.includes(opt) ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: farmingPractices.includes(opt) ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>FARMING START YEAR</Text>
        <TextInput value={farmingStartYear} onChangeText={setFarmingStartYear} keyboardType="number-pad" maxLength={4} style={styles.input} placeholder="e.g. 2015" placeholderTextColor="#888" />

        <Text style={styles.label}>SEASON</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {['Rainy','Dry','Both'].map(opt => (
            <Pressable key={opt} onPress={() => setFarmingSeason(opt)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: farmingSeason === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: farmingSeason === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        {isLivestock && (
          <>
            <Text style={styles.sectionLabel}>5. LIVESTOCK DETAILS</Text>
            <TextInput value={livestockBreed} onChangeText={setLivestockBreed} style={styles.input} placeholder="Breed (e.g. White Fulani, Kuroiler)" placeholderTextColor="#888" />
            <Text style={styles.label}>VACCINATION STATUS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {['Fully Vaccinated','Partially Vaccinated','Not Vaccinated','Unknown'].map(opt => (
                <Pressable key={opt} onPress={() => setVaccinationStatus(opt)} style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: vaccinationStatus === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: vaccinationStatus === opt ? '#000' : '#888' }}>{opt}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={vetContact} onChangeText={setVetContact} keyboardType="phone-pad" style={styles.input} placeholder="Veterinarian Contact" placeholderTextColor="#888" />
            <TextInput value={mortalityLastCycle} onChangeText={setMortalityLastCycle} keyboardType="number-pad" style={styles.input} placeholder="Mortality last cycle (count)" placeholderTextColor="#888" />
          </>
        )}

        <Text style={styles.sectionLabel}>6. PRODUCTION</Text>
        <TextInput value={currentSeason} onChangeText={setCurrentSeason} style={styles.input} placeholder="Current season (e.g. 2025 Rainy)" placeholderTextColor="#888" />
        <TextInput value={expectedYield} onChangeText={setExpectedYield} keyboardType="numeric" style={styles.input} placeholder="Expected yield (kg)" placeholderTextColor="#888" />
        <TextInput value={lastHarvestYield} onChangeText={setLastHarvestYield} keyboardType="numeric" style={styles.input} placeholder="Last harvest yield (kg)" placeholderTextColor="#888" />

        <Text style={styles.sectionLabel}>7. INPUT USAGE</Text>
        <TextInput value={fertilizerBrand} onChangeText={setFertilizerBrand} style={styles.input} placeholder="Fertilizer brand (e.g. NPK 15-15-15)" placeholderTextColor="#888" />
        <TextInput value={fertilizerKg} onChangeText={setFertilizerKg} keyboardType="numeric" style={styles.input} placeholder="Fertilizer kg / season" placeholderTextColor="#888" />
        <Text style={styles.label}>SEED SOURCE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Own Saved','Certified','Agro-Dealer','Cooperative','Government'].map(opt => (
            <Pressable key={opt} onPress={() => setSeedSource(opt)} style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: seedSource === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: seedSource === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>PESTICIDE USAGE</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {['None','Organic','Synthetic','Both'].map(opt => (
            <Pressable key={opt} onPress={() => setPesticideUsage(opt)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: pesticideUsage === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: pesticideUsage === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>8. MARKET ACCESS</Text>
        <Text style={styles.label}>WHO DO YOU SELL TO? (Select all)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Local Market','Aggregator','Cooperative','Exporter','Processor','Direct Consumer','Online'].map(opt => (
            <Pressable key={opt} onPress={() => toggleSellsTo(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: sellsTo.includes(opt) ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: sellsTo.includes(opt) ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Contract Farming</Text>
          <Pressable onPress={() => setHasContractFarming(!hasContractFarming)} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: hasContractFarming ? '#00ff88' : '#333', justifyContent: 'center', paddingHorizontal: 3 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: hasContractFarming ? 'flex-end' : 'flex-start' }} />
          </Pressable>
        </View>
        {hasContractFarming && <TextInput value={contractBuyer} onChangeText={setContractBuyer} style={styles.input} placeholder="Contract buyer name" placeholderTextColor="#888" />}

        <Text style={styles.sectionLabel}>9. HOUSEHOLD & DEMOGRAPHICS</Text>
        <TextInput value={householdSize} onChangeText={setHouseholdSize} keyboardType="number-pad" style={styles.input} placeholder="Household size" placeholderTextColor="#888" />

        <Text style={styles.label}>LITERACY</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {[{ v: 1, l: 'Illiterate' },{ v: 2, l: 'Semi' },{ v: 3, l: 'Literate' }].map(o => (
            <Pressable key={o.v} onPress={() => setLiteracyLevel(o.v as 1|2|3)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: literacyLevel === o.v ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: literacyLevel === o.v ? '#000' : '#888' }}>{o.l}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>EDUCATION</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {[{ v: 0, l: 'None' },{ v: 1, l: 'Primary' },{ v: 2, l: 'Secondary' },{ v: 3, l: 'Tertiary' },{ v: 4, l: 'Other' }].map(o => (
            <Pressable key={o.v} onPress={() => setEducationLevel(o.v as 0|1|2|3|4)} style={{ width: '31%', padding: 10, borderRadius: 8, backgroundColor: educationLevel === o.v ? '#00ff88' : '#222', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: educationLevel === o.v ? '#000' : '#888' }}>{o.l}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput value={disability} onChangeText={setDisability} style={styles.input} placeholder="Disability (if any)" placeholderTextColor="#888" />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Youth (Under 35)</Text>
          <Pressable onPress={() => setIsYouth(!isYouth)} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: isYouth ? '#00ff88' : '#333', justifyContent: 'center', paddingHorizontal: 3 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: isYouth ? 'flex-end' : 'flex-start' }} />
          </Pressable>
        </View>

        <Text style={styles.label}>VULNERABILITY</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['IDP','Refugee','Disabled','Elderly (60+)','Single Mother','Orphan-headed','Chronically Ill','Extremely Poor'].map(opt => (
            <Pressable key={opt} onPress={() => toggleVulnerability(opt)} style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: vulnerability.includes(opt) ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: vulnerability.includes(opt) ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>10. FINANCIAL</Text>
        <View style={{ gap: 6, marginBottom: 12 }}>
          {[
            { label: 'Has received agricultural credit', val: hasCredit, set: setHasCredit },
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

        {hasInsurance && (
          <>
            <TextInput value={insuranceProvider} onChangeText={setInsuranceProvider} style={styles.input} placeholder="Insurance provider (e.g. NAIC)" placeholderTextColor="#888" />
            <TextInput value={insurancePolicy} onChangeText={setInsurancePolicy} style={styles.input} placeholder="Insurance policy number" placeholderTextColor="#888" />
          </>
        )}

        <TextInput value={otherIncome} onChangeText={setOtherIncome} style={styles.input} placeholder="Other income source" placeholderTextColor="#888" />
        <TextInput value={processingCompany} onChangeText={setProcessingCompany} style={styles.input} placeholder="Processing company affiliation (optional)" placeholderTextColor="#888" />

        <Text style={styles.sectionLabel}>11. ASSETS & WATER</Text>
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

        <Text style={styles.label}>STORAGE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['None','Local Granary','Warehouse','Cold Storage'].map(opt => (
            <Pressable key={opt} onPress={() => setStorageType(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: storageType === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: storageType === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>12. COOPERATIVE</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Member of cooperative?</Text>
          <Pressable onPress={() => setIsCoopMember(!isCoopMember)} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: isCoopMember ? '#00ff88' : '#333', justifyContent: 'center', paddingHorizontal: 3 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: isCoopMember ? 'flex-end' : 'flex-start' }} />
          </Pressable>
        </View>

        {isCoopMember && (
          <>
            <TextInput value={coopName} onChangeText={setCoopName} style={styles.input} placeholder="Cooperative name" placeholderTextColor="#888" />
            <Text style={styles.label}>ROLE</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {['Member','Leader','Officer','Treasurer'].map(opt => (
                <Pressable key={opt} onPress={() => setCoopRole(opt)} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: coopRole === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: coopRole === opt ? '#000' : '#888' }}>{opt}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={coopJoinedYear} onChangeText={setCoopJoinedYear} keyboardType="number-pad" maxLength={4} style={styles.input} placeholder="Year joined" placeholderTextColor="#888" />
          </>
        )}

        <Text style={styles.sectionLabel}>13. BANKING</Text>
        <TextInput value={bankName} onChangeText={setBankName} style={styles.input} placeholder="Bank name" placeholderTextColor="#888" />
        <TextInput value={bankAccountName} onChangeText={setBankAccountName} style={styles.input} placeholder="Account name" placeholderTextColor="#888" />
        <TextInput value={bankAccountNumber} onChangeText={setBankAccountNumber} keyboardType="number-pad" maxLength={10} style={styles.input} placeholder="Account number (NUBAN)" placeholderTextColor="#888" />

        <Text style={styles.label}>MOBILE MONEY</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {['Opay','Palmpay','Moniepoint','Kuda','Paga','None'].map(opt => (
            <Pressable key={opt} onPress={() => setMobileMoneyProvider(opt === 'None' ? '' : opt)} style={{ flex: 1, minWidth: '31%', padding: 10, borderRadius: 8, backgroundColor: mobileMoneyProvider === opt ? '#00ff88' : '#222', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: mobileMoneyProvider === opt ? '#000' : '#888' }}>{opt}</Text>
            </Pressable>
          ))}
        </View>
        {mobileMoneyProvider && (
          <TextInput value={mobileMoneyNumber} onChangeText={setMobileMoneyNumber} keyboardType="phone-pad" style={styles.input} placeholder={mobileMoneyProvider + " number"} placeholderTextColor="#888" />
        )}

        {isBusiness && (
          <>
            <Text style={styles.sectionLabel}>14. BUSINESS PROFILE</Text>
            <TextInput value={businessName} onChangeText={setBusinessName} style={styles.input} placeholder="Business name" placeholderTextColor="#888" />
            <TextInput value={cacNumber} onChangeText={setCacNumber} style={styles.input} placeholder="CAC registration (RC number)" placeholderTextColor="#888" />
            <TextInput value={licenseNumber} onChangeText={setLicenseNumber} style={styles.input} placeholder="Operating license (NASC/NAFDAC)" placeholderTextColor="#888" />
            <TextInput value={businessAddress} onChangeText={setBusinessAddress} style={styles.input} placeholder="Business address" placeholderTextColor="#888" />

            {farmerCategory === 'Agro-Processing' && (
              <TextInput value={processingCapacity} onChangeText={setProcessingCapacity} keyboardType="numeric" style={styles.input} placeholder="Daily processing capacity (tonnes)" placeholderTextColor="#888" />
            )}

            {isAgroDealer && (
              <>
                <Text style={styles.label}>WHAT DO YOU SELL?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {['Fertilizer','Seeds','Pesticides','Herbicides','Equipment','Veterinary Drugs','Feed'].map(opt => (
                    <Pressable key={opt} onPress={() => toggleInputType(opt)} style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, backgroundColor: dealerInputTypes.includes(opt) ? '#00ff88' : '#222', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: dealerInputTypes.includes(opt) ? '#000' : '#888' }}>{opt}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <View style={{ marginTop: 30, padding: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: '#333' }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: '#00ff88', letterSpacing: 1.5, marginBottom: 10 }}>DATA PROTECTION & CONSENT (NDPA 2023)</Text>
          <Pressable onPress={() => setNdpaConsent(!ndpaConsent)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: ndpaConsent ? '#00ff88' : '#888', backgroundColor: ndpaConsent ? '#00ff88' : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              {ndpaConsent ? <Text style={{ fontSize: 14, fontWeight: '900', color: '#000' }}>✓</Text> : null}
            </View>
            <Text style={{ fontSize: 12, color: '#ccc', lineHeight: 18, flex: 1 }}>
              I confirm that the farmer has given explicit consent to GAIA and its partners (Ministry of Agriculture, Banks, Insurers) to collect, process, and share their farm data, GPS location, and NIN for the purpose of agricultural credit, extension services, and market access, in accordance with the Nigeria Data Protection Act (NDPA) 2023.
            </Text>
          </Pressable>
        </View>

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
