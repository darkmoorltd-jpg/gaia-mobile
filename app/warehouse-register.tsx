import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, Image, Linking, Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { WAREHOUSE_AGREEMENT, TERMS_OF_SERVICE } from '../src/legal/content';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

const DOC_SLOTS = [
  { key: 'cac_cert', label: 'CAC Certificate' },
  { key: 'tin_cert', label: 'TIN Certificate' },
  { key: 'director_id', label: 'Director Government ID' },
  { key: 'utility_bill', label: 'Utility Bill (Office)' },
  { key: 'letterhead', label: 'Company Letterhead + Stamp' },
] as const;

type Step = 1 | 2 | 3 | 4;
type DocKey = typeof DOC_SLOTS[number]['key'];

export default function WarehouseRegisterWizard() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [existing, setExisting] = useState<any>(null);

  // Identity
  const [name, setName] = useState('');
  const [cac, setCac] = useState('');
  const [tin, setTin] = useState('');
  const [years, setYears] = useState('');

  // Contact + address
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('Owner');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [state, setState] = useState('Lagos');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [locBusy, setLocBusy] = useState(false);

  // Documents — key -> uri
  const [docs, setDocs] = useState<Record<string, string | null>>({});

  // Banking + capacity
  const [bankName, setBankName] = useState('');
  const [acctNum, setAcctNum] = useState('');
  const [acctName, setAcctName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [facilityCount, setFacilityCount] = useState('1');
  const [unitTypes, setUnitTypes] = useState<string[]>([]);

  // Refs
  const [ref1Name, setRef1Name] = useState('');
  const [ref1Phone, setRef1Phone] = useState('');
  const [ref2Name, setRef2Name] = useState('');
  const [ref2Phone, setRef2Phone] = useState('');

  // Agreement
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState('');
  const [showAgreement, setShowAgreement] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!user) return;
        setChecking(true);
        const { data } = await supabase
          .from('warehouse_companies')
          .select('*')
          .eq('owner_id', user.id)
          .maybeSingle();
        setExisting(data);
        setChecking(false);
      })();
    }, [user]),
  );

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!name.trim()) return 'Company name required';
      if (!cac.trim()) return 'CAC registration required';
      if (!tin.trim()) return 'TIN required';
    }
    if (step === 2) {
      if (!contactName.trim()) return 'Contact person required';
      if (!contactPhone.trim() || contactPhone.replace(/\D/g, '').length < 10)
        return 'Valid Nigerian phone required';
      if (!contactEmail.trim() || !contactEmail.includes('@')) return 'Valid email required';
      if (!state) return 'State required';
      if (!address.trim()) return 'Address required';
      if (lat == null || lon == null) return 'Tap "Pin my location" to capture GPS';
    }
    if (step === 3) {
      if (!docs['cac_cert']) return 'CAC certificate upload required';
      if (!docs['director_id']) return 'Director ID upload required';
      if (!docs['utility_bill']) return 'Utility bill upload required';
    }
    if (step === 4) {
      if (!bankName.trim()) return 'Bank name required';
      if (acctNum.replace(/\D/g, '').length !== 10) return 'Valid 10-digit account number required';
      if (!acctName.trim()) return 'Account name required';
      if (!capacity || Number(capacity) <= 0) return 'Capacity required';
      if (!agreed) return 'You must accept the Warehouse Partner Agreement';
      if (!signature.trim()) return 'Type your full name as signature';
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { Alert.alert('Missing', err); return; }
    setStep((step + 1) as Step);
  };

  const back = () => {
    if (step === 1) { router.back(); return; }
    setStep((step - 1) as Step);
  };

  const captureLocation = async () => {
    setLocBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission required');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(pos.coords.latitude);
      setLon(pos.coords.longitude);
      Alert.alert('Location captured', `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
    } catch (e: any) {
      Alert.alert('Location failed', e.message);
    } finally {
      setLocBusy(false);
    }
  };

  const pickDoc = async (key: DocKey) => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
    });
    if (r.canceled) return;
    setDocs(d => ({ ...d, [key]: r.assets[0].uri }));
  };

  const uploadDoc = async (key: string, uri: string): Promise<string> => {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const ext = uri.split('.').pop() || 'jpg';
    const path = `${user!.id}/${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('warehouse-docs')
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
    if (error) throw error;
    return path;
  };

  const submit = async () => {
    const err = validateStep();
    if (err) { Alert.alert('Missing', err); return; }
    setBusy(true);
    try {
      // 1. Upload docs
      const docPaths: { slot: string; path: string }[] = [];
      for (const slot of DOC_SLOTS) {
        const uri = docs[slot.key];
        if (!uri) continue;
        const path = await uploadDoc(slot.key, uri);
        docPaths.push({ slot: slot.key, path });
      }

      // 2. Call registration RPC (existing signature)
      const { data, error } = await supabase.rpc('register_warehouse_company', {
        p_company_name: name.trim(),
        p_cac_registration: cac.trim().toUpperCase(),
        p_tin: tin.trim(),
        p_contact_person: contactName.trim(),
        p_contact_phone: contactPhone.trim(),
        p_contact_email: contactEmail.trim().toLowerCase(),
        p_state: state,
        p_address: address.trim(),
        p_years_in_business: parseInt(years) || 0,
        p_documents: docPaths.map(d => d.path),
        p_photos: [],
      });
      if (error) throw error;

      // 3. Update extended fields
      const { error: updErr } = await supabase
        .from('warehouse_companies')
        .update({
          head_office_lat: lat,
          head_office_lon: lon,
          bank_name: bankName.trim(),
          bank_account_number: acctNum.replace(/\D/g, ''),
          bank_account_name: acctName.trim(),
          total_capacity_tonnes: Number(capacity),
          facility_count: parseInt(facilityCount) || 1,
          unit_types: unitTypes,
          documents: docPaths,
          contact_role: contactRole,
          reference_1: ref1Name && ref1Phone ? { name: ref1Name, phone: ref1Phone } : null,
          reference_2: ref2Name && ref2Phone ? { name: ref2Name, phone: ref2Phone } : null,
          agreement_signed_at: new Date().toISOString(),
          agreement_version: WAREHOUSE_AGREEMENT.version,
          agreement_signature: signature.trim(),
        })
        .eq('owner_id', user!.id);
      if (updErr) throw updErr;

      Alert.alert(
        'Submitted',
        'Application received. Admin review takes 1-3 business days. You will be notified once approved.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert('Submission failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;
  }

  if (existing) {
    const st = existing.verification_status;
    const paid = !!existing.registration_fee_paid_at;
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Company Status</Text>

          <View style={styles.statusCard}>
            <Text style={styles.companyName}>{existing.company_name}</Text>
            <Text style={styles.cacText}>CAC: {existing.cac_registration}</Text>

            <View style={[styles.badge, { borderColor: st === 'approved' ? palette.neon : st === 'pending' ? '#ffb300' : '#ff3b5c' }]}>
              <Text style={[styles.badgeText, { color: st === 'approved' ? palette.neon : st === 'pending' ? '#ffb300' : '#ff3b5c' }]}>
                {st.toUpperCase()}
              </Text>
            </View>

            {st === 'pending' && (
              <Text style={styles.hint}>⏳ Admin is reviewing your application (1-3 business days).</Text>
            )}
            {st === 'rejected' && (
              <Text style={styles.hint}>❌ {existing.rejection_reason || 'Application rejected. Contact support.'}</Text>
            )}
            {st === 'approved' && !paid && (
              <>
                <Text style={styles.hint}>
                  ✅ Approved! Pay ₦20,000 registration fee to activate your account and start listing units.
                </Text>
                <Pressable
                  onPress={() => router.push(`/warehouse-pay-fee?company_id=${existing.id}` as any)}
                  style={styles.cta}
                >
                  <Text style={styles.ctaText}>PAY ₦20,000 REGISTRATION FEE</Text>
                </Pressable>
              </>
            )}
            {st === 'approved' && paid && (
              <>
                <Text style={styles.hint}>
                  🎉 Fully activated. Add your first unit (30 days free) from the dashboard.
                </Text>
                <Pressable onPress={() => router.push('/warehouse-dashboard' as any)} style={styles.cta}>
                  <Text style={styles.ctaText}>GO TO DASHBOARD</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // wizard
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={back}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Register Warehouse</Text>
        <View style={styles.progress}>
          {[1,2,3,4].map(s => (
            <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>Step {step} of 4</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 1 && (
          <>
            <Text style={styles.sectionLabel}>COMPANY IDENTITY</Text>
            <Text style={styles.label}>COMPANY NAME *</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Must match CAC exactly" placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>CAC REGISTRATION NUMBER *</Text>
            <TextInput value={cac} onChangeText={setCac} style={styles.input} placeholder="RC-1234567" placeholderTextColor={palette.textDim} autoCapitalize="characters" />
            <Text style={styles.label}>TIN *</Text>
            <TextInput value={tin} onChangeText={setTin} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>YEARS IN BUSINESS</Text>
            <TextInput value={years} onChangeText={setYears} keyboardType="number-pad" style={styles.input} placeholderTextColor={palette.textDim} placeholder="e.g. 5" />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.sectionLabel}>CONTACT PERSON</Text>
            <Text style={styles.label}>FULL NAME *</Text>
            <TextInput value={contactName} onChangeText={setContactName} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>ROLE</Text>
            <View style={styles.row}>
              {['Owner', 'Director', 'Manager'].map(r => (
                <Pressable key={r} onPress={() => setContactRole(r)} style={[styles.chip, contactRole === r && styles.chipActive]}>
                  <Text style={[styles.chipText, contactRole === r && { color: '#000' }]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>PHONE *</Text>
            <TextInput value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" style={styles.input} placeholder="080..." placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>EMAIL *</Text>
            <TextInput value={contactEmail} onChangeText={setContactEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholderTextColor={palette.textDim} />

            <Text style={styles.sectionLabel}>HEAD OFFICE</Text>
            <Text style={styles.label}>STATE *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
              {NIGERIAN_STATES.map(s => (
                <Pressable key={s} onPress={() => setState(s)} style={[styles.chip, state === s && styles.chipActive]}>
                  <Text style={[styles.chipText, state === s && { color: '#000' }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>ADDRESS *</Text>
            <TextInput value={address} onChangeText={setAddress} multiline style={[styles.input, { minHeight: 70 }]} placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>GPS PIN *</Text>
            <Pressable onPress={captureLocation} disabled={locBusy} style={styles.locBtn}>
              {locBusy ? <ActivityIndicator color={palette.neon} /> :
                <Text style={styles.locBtnText}>
                  {lat != null ? `📍 ${lat.toFixed(5)}, ${lon?.toFixed(5)}` : '📍 TAP TO PIN MY LOCATION'}
                </Text>}
            </Pressable>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.sectionLabel}>REQUIRED DOCUMENTS</Text>
            {DOC_SLOTS.map(slot => {
              const uri = docs[slot.key];
              const required = ['cac_cert', 'director_id', 'utility_bill'].includes(slot.key);
              return (
                <View key={slot.key} style={styles.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docLabel}>{slot.label}{required ? ' *' : ''}</Text>
                    <Text style={styles.docStatus}>{uri ? '✓ Uploaded' : 'Not uploaded'}</Text>
                  </View>
                  {uri ? (
                    <Image source={{ uri }} style={styles.thumb} />
                  ) : null}
                  <Pressable onPress={() => pickDoc(slot.key)} style={styles.docBtn}>
                    <Text style={styles.docBtnText}>{uri ? 'CHANGE' : 'UPLOAD'}</Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.sectionLabel}>PAYOUT BANK ACCOUNT</Text>
            <Text style={styles.label}>BANK NAME *</Text>
            <TextInput value={bankName} onChangeText={setBankName} style={styles.input} placeholder="e.g. Access Bank" placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>ACCOUNT NUMBER * (10 digits)</Text>
            <TextInput value={acctNum} onChangeText={setAcctNum} keyboardType="number-pad" maxLength={10} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>ACCOUNT NAME * (must match CAC)</Text>
            <TextInput value={acctName} onChangeText={setAcctName} style={styles.input} placeholderTextColor={palette.textDim} />

            <Text style={styles.sectionLabel}>CAPACITY</Text>
            <Text style={styles.label}>TOTAL CAPACITY (TONNES) *</Text>
            <TextInput value={capacity} onChangeText={setCapacity} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>NUMBER OF FACILITIES</Text>
            <TextInput value={facilityCount} onChangeText={setFacilityCount} keyboardType="number-pad" style={styles.input} placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>UNIT TYPES</Text>
            <View style={styles.row}>
              {['cold', 'dry', 'humidity', 'fumigation'].map(t => {
                const active = unitTypes.includes(t);
                return (
                  <Pressable
                    key={t}
                    onPress={() => setUnitTypes(u => active ? u.filter(x => x !== t) : [...u, t])}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && { color: '#000' }]}>{t.toUpperCase()}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>REFERENCES (OPTIONAL)</Text>
            <Text style={styles.label}>REFERENCE 1 — NAME</Text>
            <TextInput value={ref1Name} onChangeText={setRef1Name} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>REFERENCE 1 — PHONE</Text>
            <TextInput value={ref1Phone} onChangeText={setRef1Phone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>REFERENCE 2 — NAME</Text>
            <TextInput value={ref2Name} onChangeText={setRef2Name} style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>REFERENCE 2 — PHONE</Text>
            <TextInput value={ref2Phone} onChangeText={setRef2Phone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={palette.textDim} />

            <Text style={styles.sectionLabel}>AGREEMENT</Text>
            <Pressable onPress={() => setAgreed(a => !a)} style={styles.checkRow}>
              <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                {agreed ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkLabel}>
                I have read and accept the{' '}
                <Text style={styles.link} onPress={() => setShowAgreement(true)}>
                  Warehouse Partner Agreement
                </Text>
                {' '}and{' '}
                <Text style={styles.link} onPress={() => router.push('/legal/terms' as any)}>
                  Terms of Service
                </Text>.
              </Text>
            </Pressable>

            <Text style={styles.label}>E-SIGNATURE — TYPE FULL NAME *</Text>
            <TextInput
              value={signature}
              onChangeText={setSignature}
              style={styles.input}
              placeholder="Type your full legal name"
              placeholderTextColor={palette.textDim}
            />

            <Text style={styles.metaSmall}>
              By submitting you confirm all information is accurate. False information may result in permanent ban and legal action.
            </Text>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footer}>
        {step < 4 ? (
          <Pressable onPress={next} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>CONTINUE</Text>
          </Pressable>
        ) : (
          <Pressable onPress={submit} disabled={busy} style={[styles.primaryBtn, busy && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>SUBMIT APPLICATION</Text>}
          </Pressable>
        )}
      </View>

      <Modal visible={showAgreement} animationType="slide">
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => setShowAgreement(false)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title}>Warehouse Agreement</Text>
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.agreementText}>{WAREHOUSE_AGREEMENT.body}</Text>
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  progress: { flexDirection: 'row', gap: 6, marginTop: 16 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: p.border },
  progressDotActive: { backgroundColor: p.neon },
  stepLabel: { fontSize: 11, color: p.textMuted, marginTop: 8 },
  scroll: { padding: 20, paddingBottom: 120 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 24, marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 14, marginBottom: 6, letterSpacing: 1 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipActive: { borderColor: p.neon, backgroundColor: p.neon },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  locBtn: { padding: 16, borderRadius: 12, backgroundColor: 'rgba(0,255,136,0.1)', borderWidth: 1, borderColor: p.neon, alignItems: 'center', marginTop: 6 },
  locBtnText: { color: p.neon, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: p.surface, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  docLabel: { fontSize: 13, color: p.text, fontWeight: '700' },
  docStatus: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  thumb: { width: 40, height: 40, borderRadius: 6 },
  docBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: p.neon },
  docBtnText: { color: p.neon, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: p.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxActive: { borderColor: p.neon, backgroundColor: p.neon },
  checkMark: { color: '#000', fontSize: 16, fontWeight: '900' },
  checkLabel: { flex: 1, fontSize: 13, color: p.text, lineHeight: 20 },
  link: { color: p.neon, textDecorationLine: 'underline' },
  metaSmall: { fontSize: 11, color: p.textMuted, marginTop: 16, lineHeight: 16 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 30, backgroundColor: p.obsidian, borderTopWidth: 1, borderTopColor: p.border },
  primaryBtn: { backgroundColor: p.neon, padding: 18, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
  statusCard: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginTop: 20 },
  companyName: { fontSize: 22, fontWeight: '900', color: p.text },
  cacText: { fontSize: 12, color: p.textMuted, marginTop: 4, fontFamily: 'monospace' },
  badge: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 12 },
  badgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  hint: { fontSize: 13, color: p.text, marginTop: 16, lineHeight: 20 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  agreementText: { fontSize: 12, color: p.text, lineHeight: 19 },
});
