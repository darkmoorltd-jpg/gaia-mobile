import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { DRIVER_AGREEMENT } from '../src/legal/content';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
const LICENSE_CLASSES = ['A', 'B', 'C', 'D', 'E', 'G', 'H'];
const RELATIONS = ['Spouse', 'Parent', 'Sibling', 'Friend', 'Other'];
const VEHICLE_TYPES = ['Flatbed', 'Van', 'Truck', 'Refrigerated', 'Tanker', 'Other'];

type Step = 1 | 2 | 3;

export default function DriverRegister() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);

  // Identity
  const [dob, setDob] = useState('');
  const [licenseNum, setLicenseNum] = useState('');
  const [licenseClass, setLicenseClass] = useState('C');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [licenseFront, setLicenseFront] = useState<string | null>(null);
  const [licenseBack, setLicenseBack] = useState<string | null>(null);
  const [nin, setNin] = useState('');
  const [ninSlip, setNinSlip] = useState<string | null>(null);

  // Address + emergency
  const [homeState, setHomeState] = useState('Lagos');
  const [homeLga, setHomeLga] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecRelation, setEcRelation] = useState('Spouse');

  // Vehicle
  const [plate, setPlate] = useState('');
  const [vType, setVType] = useState('Flatbed');
  const [capacity, setCapacity] = useState('');
  const [chassis, setChassis] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [vReg, setVReg] = useState<string | null>(null);
  const [vInsurance, setVInsurance] = useState<string | null>(null);
  const [vRoad, setVRoad] = useState<string | null>(null);
  const [vFront, setVFront] = useState<string | null>(null);
  const [vRear, setVRear] = useState<string | null>(null);

  // Bank + agreement
  const [bankName, setBankName] = useState('');
  const [acctNum, setAcctNum] = useState('');
  const [acctName, setAcctName] = useState('');
  const [sig, setSig] = useState('');
  const [agreed, setAgreed] = useState(false);

  const pick = async (setter: (s: string | null) => void) => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!r.canceled) setter(r.assets[0].uri);
  };

  const upload = async (uri: string, key: string): Promise<string> => {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const ext = uri.split('.').pop() || 'jpg';
    const path = `${user!.id}/${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('driver-docs').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
    if (error) throw error;
    return path;
  };

  const validate = (): string | null => {
    if (step === 1) {
      if (!dob) return 'Date of birth required';
      const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000));
      if (age < 21) return 'Must be at least 21 years old';
      if (!licenseNum.trim()) return 'License number required';
      if (!licenseExpiry) return 'License expiry required';
      if (new Date(licenseExpiry) < new Date()) return 'License is expired';
      if (!licenseFront) return 'License front photo required';
      if (!licenseBack) return 'License back photo required';
      if (nin.replace(/\D/g, '').length !== 11) return 'NIN must be 11 digits';
      if (!ninSlip) return 'NIN slip required';
    }
    if (step === 2) {
      if (!homeLga.trim()) return 'LGA required';
      if (!homeAddress.trim()) return 'Address required';
      if (!ecName.trim()) return 'Emergency contact name required';
      if (ecPhone.replace(/\D/g, '').length < 10) return 'Emergency phone must be valid';
      if (!plate.trim()) return 'Plate number required';
      if (!capacity || Number(capacity) <= 0) return 'Capacity required';
      if (!insuranceExpiry) return 'Insurance expiry required';
      if (!vReg) return 'Vehicle registration document required';
      if (!vInsurance) return 'Insurance certificate required';
      if (!vRoad) return 'Road worthiness required';
      if (!vFront) return 'Vehicle front photo required';
      if (!vRear) return 'Vehicle rear photo required';
    }
    if (step === 3) {
      if (!bankName.trim()) return 'Bank name required';
      if (acctNum.replace(/\D/g, '').length !== 10) return 'Account number must be 10 digits';
      if (!acctName.trim()) return 'Account name required';
      if (!agreed) return 'You must accept the Driver Agreement';
      if (!sig.trim()) return 'Type your full name as signature';
    }
    return null;
  };

  const next = () => {
    const err = validate();
    if (err) return Alert.alert('Missing', err);
    setStep((step + 1) as Step);
  };
  const back = () => { if (step === 1) router.back(); else setStep((step - 1) as Step); };

  const submit = async () => {
    const err = validate();
    if (err) return Alert.alert('Missing', err);
    setBusy(true);
    try {
      const [lfUrl, lbUrl, ninUrl, vRegUrl, vInsUrl, vRoadUrl, vFrontUrl, vRearUrl] = await Promise.all([
        upload(licenseFront!, 'license_front'),
        upload(licenseBack!, 'license_back'),
        upload(ninSlip!, 'nin_slip'),
        upload(vReg!, 'vehicle_reg'),
        upload(vInsurance!, 'vehicle_insurance'),
        upload(vRoad!, 'vehicle_road'),
        upload(vFront!, 'vehicle_front'),
        upload(vRear!, 'vehicle_rear'),
      ]);

      const { error } = await supabase.rpc('register_driver_application', {
        p_license_number: licenseNum.trim().toUpperCase(),
        p_license_class: licenseClass,
        p_license_expiry: licenseExpiry,
        p_license_front_url: lfUrl,
        p_license_back_url: lbUrl,
        p_nin: nin.replace(/\D/g, ''),
        p_nin_slip_url: ninUrl,
        p_date_of_birth: dob,
        p_home_state: homeState,
        p_home_lga: homeLga.trim(),
        p_home_address: homeAddress.trim(),
        p_emergency_name: ecName.trim(),
        p_emergency_phone: ecPhone.trim(),
        p_emergency_relation: ecRelation,
        p_bank_name: bankName.trim(),
        p_bank_account_number: acctNum.replace(/\D/g, ''),
        p_bank_account_name: acctName.trim(),
        p_plate_number: plate.trim().toUpperCase(),
        p_vehicle_type: vType,
        p_capacity_tonnes: Number(capacity),
        p_vehicle_reg_url: vRegUrl,
        p_vehicle_insurance_url: vInsUrl,
        p_vehicle_road_url: vRoadUrl,
        p_vehicle_photo_front: vFrontUrl,
        p_vehicle_photo_rear: vRearUrl,
        p_vehicle_chassis: chassis.trim() || null,
        p_insurance_expiry: insuranceExpiry,
        p_agreement_signature: sig.trim(),
      });
      if (error) throw error;
      Alert.alert('Submitted', 'Admin review takes 1-3 business days.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={back}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Driver Application</Text>
        <View style={styles.progress}>{[1,2,3].map(s => <View key={s} style={[styles.dot, step >= s && styles.dotActive]} />)}</View>
        <Text style={styles.stepLabel}>Step {step} of 3</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 1 && (
          <>
            <Text style={styles.sectionLabel}>PERSONAL</Text>
            <Text style={styles.label}>DATE OF BIRTH (YYYY-MM-DD) *</Text>
            <TextInput value={dob} onChangeText={setDob} placeholder="1995-06-15" style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>NIN (11 digits) *</Text>
            <TextInput value={nin} onChangeText={setNin} keyboardType="number-pad" maxLength={11} style={styles.input} placeholderTextColor={palette.textDim} />
            <DocRow label="NIN slip" uri={ninSlip} onPick={() => pick(setNinSlip)} />

            <Text style={styles.sectionLabel}>DRIVER LICENSE</Text>
            <Text style={styles.label}>LICENSE NUMBER *</Text>
            <TextInput value={licenseNum} onChangeText={setLicenseNum} style={styles.input} autoCapitalize="characters" placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>CLASS *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {LICENSE_CLASSES.map(c => (
                <Pressable key={c} onPress={() => setLicenseClass(c)} style={[styles.chip, licenseClass === c && styles.chipOn]}>
                  <Text style={[styles.chipTxt, licenseClass === c && { color: '#000' }]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>EXPIRY DATE (YYYY-MM-DD) *</Text>
            <TextInput value={licenseExpiry} onChangeText={setLicenseExpiry} placeholder="2027-12-31" style={styles.input} placeholderTextColor={palette.textDim} />
            <DocRow label="License front *" uri={licenseFront} onPick={() => pick(setLicenseFront)} />
            <DocRow label="License back *" uri={licenseBack} onPick={() => pick(setLicenseBack)} />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.sectionLabel}>HOME ADDRESS</Text>
            <Text style={styles.label}>STATE *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {NIGERIAN_STATES.map(s => (
                <Pressable key={s} onPress={() => setHomeState(s)} style={[styles.chip, homeState === s && styles.chipOn]}>
                  <Text style={[styles.chipTxt, homeState === s && { color: '#000' }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>LGA *</Text>
            <TextInput value={homeLga} onChangeText={setHomeLga} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>STREET ADDRESS *</Text>
            <TextInput value={homeAddress} onChangeText={setHomeAddress} multiline style={[styles.input, { minHeight: 60 }]} placeholderTextColor={palette.textDim} />

            <Text style={styles.sectionLabel}>EMERGENCY CONTACT</Text>
            <Text style={styles.label}>NAME *</Text>
            <TextInput value={ecName} onChangeText={setEcName} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>PHONE *</Text>
            <TextInput value={ecPhone} onChangeText={setEcPhone} keyboardType="phone-pad" style={styles.input} placeholder="080..." placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>RELATIONSHIP</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {RELATIONS.map(r => (
                <Pressable key={r} onPress={() => setEcRelation(r)} style={[styles.chip, ecRelation === r && styles.chipOn]}>
                  <Text style={[styles.chipTxt, ecRelation === r && { color: '#000' }]}>{r}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>VEHICLE</Text>
            <Text style={styles.label}>PLATE NUMBER *</Text>
            <TextInput value={plate} onChangeText={setPlate} autoCapitalize="characters" style={styles.input} placeholder="KJA-123-XY" placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>TYPE *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {VEHICLE_TYPES.map(t => (
                <Pressable key={t} onPress={() => setVType(t)} style={[styles.chip, vType === t && styles.chipOn]}>
                  <Text style={[styles.chipTxt, vType === t && { color: '#000' }]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>CAPACITY (TONNES) *</Text>
            <TextInput value={capacity} onChangeText={setCapacity} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>CHASSIS NUMBER (optional)</Text>
            <TextInput value={chassis} onChangeText={setChassis} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>INSURANCE EXPIRY (YYYY-MM-DD) *</Text>
            <TextInput value={insuranceExpiry} onChangeText={setInsuranceExpiry} placeholder="2027-06-30" style={styles.input} placeholderTextColor={palette.textDim} />
            <DocRow label="Vehicle registration *" uri={vReg} onPick={() => pick(setVReg)} />
            <DocRow label="Insurance certificate *" uri={vInsurance} onPick={() => pick(setVInsurance)} />
            <DocRow label="Road worthiness *" uri={vRoad} onPick={() => pick(setVRoad)} />
            <DocRow label="Vehicle photo (front) *" uri={vFront} onPick={() => pick(setVFront)} />
            <DocRow label="Vehicle photo (rear) *" uri={vRear} onPick={() => pick(setVRear)} />
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.sectionLabel}>PAYOUT BANK</Text>
            <Text style={styles.label}>BANK NAME *</Text>
            <TextInput value={bankName} onChangeText={setBankName} style={styles.input} placeholder="Access Bank" placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>ACCOUNT NUMBER (10 digits) *</Text>
            <TextInput value={acctNum} onChangeText={setAcctNum} keyboardType="number-pad" maxLength={10} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>ACCOUNT NAME *</Text>
            <TextInput value={acctName} onChangeText={setAcctName} style={styles.input} placeholderTextColor={palette.textDim} />

            <Text style={styles.sectionLabel}>AGREEMENT</Text>
            <Pressable onPress={() => setAgreed(a => !a)} style={styles.checkRow}>
              <View style={[styles.cb, agreed && styles.cbOn]}>{agreed ? <Text style={styles.cm}>✓</Text> : null}</View>
              <Text style={styles.cbLabel}>
                I accept the <Text style={styles.link} onPress={() => setShowAgreement(true)}>Driver Agreement</Text>.
              </Text>
            </Pressable>
            <Text style={styles.label}>E-SIGNATURE *</Text>
            <TextInput value={sig} onChangeText={setSig} style={styles.input} placeholder="Your full legal name" placeholderTextColor={palette.textDim} />
          </>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <View style={styles.footer}>
        {step < 3 ? (
          <Pressable onPress={next} style={styles.cta}><Text style={styles.ctaText}>CONTINUE</Text></Pressable>
        ) : (
          <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>SUBMIT APPLICATION</Text>}
          </Pressable>
        )}
      </View>

      <Modal visible={showAgreement} animationType="slide">
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => setShowAgreement(false)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title}>Driver Agreement</Text>
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={{ fontSize: 12, color: palette.text, lineHeight: 19 }}>{DRIVER_AGREEMENT.body}</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function DocRow({ label, uri, onPick }: { label: string; uri: string | null; onPick: () => void }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.border, marginBottom: 8 }}>
      <Text style={{ flex: 1, fontSize: 13, color: palette.text }}>{label}</Text>
      <Text style={{ fontSize: 11, color: uri ? palette.neon : palette.textMuted, fontWeight: '800' }}>{uri ? '✓' : '—'}</Text>
      <Pressable onPress={onPick} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: palette.neon, borderRadius: 8 }}>
        <Text style={{ fontSize: 10, fontWeight: '900', color: palette.neon }}>{uri ? 'CHANGE' : 'UPLOAD'}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  progress: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: p.border },
  dotActive: { backgroundColor: p.neon },
  stepLabel: { fontSize: 11, color: p.textMuted, marginTop: 8 },
  scroll: { padding: 20, paddingBottom: 120 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 24, marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 14, marginBottom: 6, letterSpacing: 1 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: p.neon },
  chipTxt: { fontSize: 11, fontWeight: '700', color: p.textDim },
  checkRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cb: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  cbOn: { borderColor: p.neon, backgroundColor: p.neon },
  cm: { fontSize: 16, fontWeight: '900', color: '#000' },
  cbLabel: { flex: 1, fontSize: 13, color: p.text, lineHeight: 20 },
  link: { color: p.neon, textDecorationLine: 'underline' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 30, backgroundColor: p.obsidian, borderTopWidth: 1, borderTopColor: p.border },
  cta: { backgroundColor: p.neon, padding: 18, borderRadius: 14, alignItems: 'center' },
  ctaText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
