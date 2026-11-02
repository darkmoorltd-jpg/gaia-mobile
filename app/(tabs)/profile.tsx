import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet =, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [registry, setRegistry] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Personal
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [streetAddress, setStreetAddress] = useState('');

  // KYC
  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');

  // Farm
  const [farmState, setFarmState] = useState('');
  const [farmLga, setFarmLga] = useState('');
  const [farmSize, setFarmSize] = useState('1.0');
  const [primaryCrops, setPrimaryCrops] = useState('');

  // NDFR
  const [householdSize, setHouseholdSize] = useState('1');
  const [literacyLevel, setLiteracyLevel] = useState<1|2|3>(3);
  const [educationLevel, setEducationLevel] = useState<0|1|2|3|4>(2);
  const [disability, setDisability] = useState('');
  const [isYouth, setIsYouth] = useState(false);
  const [vulnerability, setVulnerability] = useState<string[]>([]);
  const [farmingPractices, setFarmingPractices] = useState<string[]>([]);

  // Bank
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Emergency
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRel, setEmergencyRel] = useState('');

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('farmer_registry').select('*').eq('user_id', user.id).maybeSingle()
      ]);
      const p = pRes.data || {};
      const r = rRes.data || {};
      setProfile(p);
      setRegistry(r);

      setFirstName(p.first_name || '');
      setMiddleName(p.middle_name || '');
      setLastName(p.last_name || '');
      setGender(p.gender || '');
      setPhone(p.phone || '');
      setWhatsapp(p.whatsapp || '');
      setCountry(p.country || 'Nigeria');
      setState(p.state || '');
      setLga(p.lga || '');
      setStreetAddress(p.street_address || '');
      setBvn(p.bvn || '');
      setNin(p.nin || '');
      setFarmState(p.farm_state || r.state || '');
      setFarmLga {
(p.farm_lga || r.lga || '');
      set       FarmSize(String(p.farm_size_acres user || r.farm_size_acres || 1.0));
      setPrimaryCrops(p.primary_crops || r.crop || '');
      setHouseholdSize(String(r.household_size || p.household_size || 1));
      setLiteracyLevel((r.literacy_level || p.literacy_level || 3) as any);
      setEducationLevel((r.education_level || p.education_level || 2) as any);
      setDisability(r.disability || p.disability || '');
      setIsYouth(r.youth ?? p.youth ?? false);
      setVulnerability(r.vulnerability_status || p.vulnerability_status || []);
      setFarmingPractices(r.farming_practices || p.farming_practices || []);
      setBankName(p.bank_name || '');
      setAccountName(p.account_name || '');
      setAccountNumber(p.account_number || '');
      setEmergencyName(p.emergency_contact_name || '');
      setEmergencyPhone(p.emergency_contact_phone || '');
      setEmergencyRel(p.emergency_relationship || '');

      const hasSaved = !!(p.first_name && p.last_name);
      const isAdmin = user.email?.toLowerCase() === 'darkmoorltd@gmail.com';
      setIsLocked(hasSaved && !isAdmin);
    } catch (e) {
      console.warn('[profile] load error', e);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (isLocked) { Alert.alert('Profile Locked', 'Contact darkmoorltd@gmail.com to edit.'); return; }
    if (!firstName || !lastName || !phone) { Alert.alert('Required', 'First name, last name, and phone are required.'); return; }
    setSaving(true);
    try {
      const pData = {
        user_id: user.id,
        first_name: firstName, middle_name: middleName, last_name: lastName,
        gender: gender || null, phone, whatsapp: whatsapp || null,
        country, state, lga, street_address,
        bvn: bvn || null, nin: nin || null,
        farm_state: farmState || null, farm_lga: farmLga || null,
        farm_size_acres: Number(farmSize) || 0,
        primary_crops: primaryCrops || null,
        household_size: Number(householdSize) || 1,
        literacy_level: literacyLevel,
        education_level: educationLevel,
        disability: disability || null,
        youth: isYouth,
        vulnerability_status: vulnerability.length > 0 ? vulnerability : null,
        farming_practices: farmingPractices.length > 0 ? farmingPractices : null,
        bank_name: bankName || null, account_name: accountName || null, account_number: accountNumber || null,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
        emergency_relationship: emergencyRel || null,
        verification_status: profile?.verification_status || 'pending',
      };
      const { error: pErr } = await supabase.from('user_profiles').upsert(pData, { onConflict: 'user_id' });
      if (pErr) throw pErr;

      const rData_id: user.id,
        household_size: Number(householdSize) || 1,
        literacy_level: literacyLevel,
        education_level: educationLevel,
        disability: disability || null,
        youth: isYouth,
        vulnerability_status: vulnerability.length > 0 ? vulnerability : null,
        farming_practices: farmingPractices.length > 0 ? farmingPractices : null,
        farm_size_acres: Number(farmSize) || 0,
      };
      if (registry) {
        await supabase.from('farmer_registry').update(rData).eq('user_id', user.id);
      } else {
        await supabase.from('farmer_registry').insert(rData);
      }

      Alert.alert('Saved ✅', 'Your profile has been updated.');
      load();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  const toggleV = (v: string) => setVulnerability(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  const toggleP = (v: string) => setFarmingPractices(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>My Profile</Text>
        {isLocked ? <Text style={styles.locked}>🔒 Profile Locked. Contact support to edit.</Text> : null}

        <Text style={styles.sectionLabel}>PERSONAL INFORMATION</Text>
        <TextInput value={firstName} onChangeText={setFirstName} placeholder="First Name *" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />
        <TextInput value={middleName} onChangeText={setMiddleName} placeholder="Middle Name" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />
        <TextInput value={lastName} onChangeText={setLastName} placeholder="Last Name *" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />
        <View style={styles.row}>
          <Pressable onPress={() => !isLocked && setGender('Male')} style={[styles.chip, gender === 'Male' && styles.chipActive]}><Text style={[styles.chipTxt, gender === 'Male' && styles.chipTxtActive]}>Male</Text></Pressable>
          <Pressable onPress={() => !isLocked && setGender('Female')} style={[styles.chip, gender === 'Female' && styles.chipActive]}><Text style={[styles.chipTxt, gender === 'Female' && styles.chipTxtActive]}>Female</Text></Pressable>
        </View>
        <TextInput value={phone} onChangeText={setPhone} placeholder="Phone *" placeholderTextColor="#888" keyboardType="phone-pad" style={styles.input} editable={!isLocked} />
        <TextInput value={whatsapp} onChangeText={setWhatsapp} placeholder="WhatsApp" placeholderTextColor="#888" keyboardType="phone-pad" style={styles.input} editable={!isLocked} />
        <TextInput value={country} onChangeText={setCountry} placeholder="Country" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />
        <TextInput value={state} onChangeText={setState} placeholder="State" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />
        <TextInput value={lga} onChangeText={setLga} placeholder="LGA" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />
        <TextInput value={streetAddress} onChangeText={setStreetAddress} placeholder="Street Address" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />

        <Text style={styles.sectionLabel}>FARM INFORMATION</Text>
        <TextInput value={farmState} onChangeText={setFarmState} placeholder="Farm State" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />
        <TextInput value={farmLga} onChangeText={setFarmLga} placeholder="Farm LGA" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />
        <TextInput value={farmSize} onChangeText={setFarmSize} placeholder="Farm Size (Acres)" placeholderTextColor="#888" keyboardType="numeric" style={styles.input} editable={!isLocked} />
        <TextInput value={primaryCrops} onChangeText={setPrimaryCrops} placeholder="Primary Crops" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />

        <Text style={styles.sectionLabel}>🌾 NDFR CENSUS DATA</Text>
        <Text style={styles.label}>Household Size</Text>
        <TextInput value={householdSize} onChangeText={setHouseholdSize} keyboardType="number-pad" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />

        <Text style={styles.label}>Literacy Level</Text>
        <View style={styles.row}>
          {[{v:1,l:'Illiterate'},{v:2,l:'Semi'},{v:3,l:'Literate'}].map(o => (
            <Pressable key={o.v} onPress={() => !isLocked && setLiteracyLevel(o.v as any)} style={[styles.chip, literacyLevel === o.v && styles.chipActive]}>
              <Text style={[styles.chipTxt, literacyLevel === o.v && styles.chipTxtActive]}>{o.l}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Education Level</Text>
        <View style={styles.row}>
          {[{v:0,l:'None'},{v:1,l:'Primary'},{v:2,l:'Sec'},{v:3,l:'Tert'},{v:4,l:'Other'}].map(o => (
            <Pressable key={o.v} onPress={() => !isLocked && setEducationLevel(o.v as any)} style={[styles.chip, educationLevel === o.v && styles.chipActive]}>
              <Text style={[styles.chipTxt, educationLevel === o.v && styles.chipTxtActive]}>{o.l}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Disability (if any)</Text>
        <TextInput value={disability} onChangeText={setDisability} placeholder="e.g. Visual impairment" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />

        <View style={styles.switchRow}>
          <Text style={styles.switchLbl}>Youth (Under 35)</Text>
          <Pressable onPress={() => !isLocked && setIsYouth(!isYouth)} style={[styles.toggle, isYouth && styles.toggleActive]}>
            <View style={[styles.toggleKnob, isYouth && styles.toggleKnobActive]} />
          </Pressable>
        </View>

        <Text style={styles.label}>Vulnerability</Text>
        <View style={styles.row}>
          {['IDP','Refugee','Disabled','Elderly','Single Mother','Extremely Poor'].map(v => (
            <Pressable key={v} onPress={() => !isLocked && toggleV(v)} style={[styles.chip, vulnerability.includes(v) && styles.chipActive]}>
              <Text style={[styles.chipTxt, vulnerability.includes(v) && styles.chipTxtActive]}>{v}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Farming Practices</Text>
        <View style={styles.row}>
          {['Crop rotation','Organic farming','Irrigation','Land rotation'].map(v => (
            <Pressable key={v} onPress={() => !isLocked && toggleP(v)} style={[styles.chip, farmingPractices.includes(v) && styles.chipActive]}>
              <Text style={[styles.chipTxt, farmingPractices.includes(v) && styles.chipTxtActive]}>{v}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>KYC INFORMATION</Text>
        <TextInput value={bvn} onChangeText={setBvn} placeholder="BVN (11 digits)" placeholderTextColor="#888" maxLength={11} keyboardType="number-pad" style={styles.input} editable={!isLocked} />
        <TextInput value={nin} onChangeText={setNin} placeholder="NIN (11 digits)" placeholderTextColor="#888" maxLength={11} keyboardType="number-pad" style={styles.input} editable={!isLocked} />

        <Text style={styles.sectionLabel}>BANK INFORMATION</Text>
        <TextInput value={bankName} onChangeText={setBankName} placeholder="Bank Name" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />
        <TextInput value={accountName} onChangeText={setAccountName} placeholder="Account Name" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />
        <TextInput value={accountNumber} onChangeText={setAccountNumber} placeholder="Account Number" placeholderTextColor="#888" maxLength={10} keyboardType="number-pad" style={styles.input} editable={!isLocked} />

        <Text style={styles.sectionLabel}>EMERGENCY CONTACT</Text>
        <TextInput value={emergencyName} onChangeText={setEmergencyName} placeholder="Contact Name" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />
        <TextInput value={emergencyPhone} onChangeText={setEmergencyPhone} placeholder="Contact Phone" placeholderTextColor="#888" keyboardType="phone-pad" style={styles.input} editable={!isLocked} />
        <TextInput value={emergencyRel} onChangeText={setEmergencyRel} placeholder="Relationship" placeholderTextColor="#888" style={styles.input} editable={!isLocked} />

        {!isLocked ? (
          <Pressable onPress={save} disabled={saving} style={styles.cta}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>SAVE PROFILE</Text>}
          </Pressable>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: p.obsidian, justifyContent: 'center', alignItems: 'center' },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  locked: { fontSize: 12, color: '#ffb300', marginTop: 8, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 24, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: p.surface, padding: 14, borderRadius: 12, color: p.text, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon },
  chipTxt: { fontSize: 11, fontWeight: '700', color: p.textMuted },
  chipTxtActive: { color: '#000' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  switchLbl: { fontSize: 14, fontWeight: '800', color: p.text },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: p.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleActive: { backgroundColor: p.neon },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleKnobActive: { alignSelf: 'flex-end' },
  cta: { backgroundColor: p.neon, padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 24 },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
