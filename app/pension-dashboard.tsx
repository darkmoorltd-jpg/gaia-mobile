import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function PensionDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  const [nin, setNin] = useState('');
  const [pensionPin, setPensionPin] = useState('');
  const [pensionAmount, setPensionAmount] = useState('');
  const [hectares, setHectares] = useState('');
  const [wantsLease, setWantsLease] = useState(false);
  const [nextOfKin, setNextOfKin] = useState('');
  const [nokPhone, setNokPhone] = useState('');

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('retired_farmers').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        setProfile(data);
        setNin(data.nin || '');
        setPensionPin(data.pension_pin || '');
        setPensionAmount(data.monthly_pension_amount?.toString() || '');
        setHectares(data.farm_hectares?.toString() || '');
        setWantsLease(data.wants_to_lease || false);
        setNextOfKin(data.next_of_kin_name || '');
        setNokPhone(data.next_of_kin_phone || '');
      }
      setLoading(false);
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!nin || nin.length !== 11) { Alert.alert('Error', 'NIN must be 11 digits.'); return; }
    setSaving(true);
    const { error } = await supabase.from('retired_farmers').upsert({
      user_id: user.id,
      nin,
      pension_pin: pensionPin,
      monthly_pension_amount: Number(pensionAmount) || 0,
      farm_hectares: Number(hectares) || 0,
      wants_to_lease: wantsLease,
      next_of_kin_name: nextOfKin,
      next_of_kin_phone: nokPhone,
      verified_by_agent: false // Admin or Agent sets this to true later
    }, { onConflict: 'user_id' });

    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Saved', 'Your pension and legacy profile has been updated.');
    setSaving(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <Text style={styles.title}>Legacy & Pension</Text>
        <Text style={styles.subtitle}>Secure your pension and lease your land to young farmers.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>PENSION DETAILS</Text>
          <Text style={styles.label}>NIN (11 DIGITS)</Text>
          <TextInput value={nin} onChangeText={setNin} keyboardType="number-pad" maxLength={11} placeholder="e.g. 12345678901" placeholderTextColor="#888" style={styles.input} />
          
          <Text style={styles.label}>PENSION PIN (PenCom)</Text>
          <TextInput value={pensionPin} onChangeText={setPensionPin} placeholder="e.g. PEN-123456" placeholderTextColor="#888" style={styles.input} />
          
          <Text style={styles.label}>MONTHLY PENSION (₦)</Text>
          <TextInput value={pensionAmount} onChangeText={setPensionAmount} keyboardType="number-pad" placeholder="e.g. 45000" placeholderTextColor="#888" style={styles.input} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>FARM ASSETS</Text>
          <Text style={styles.label}>TOTAL FARM SIZE (HECTARES)</Text>
          <TextInput value={hectares} onChangeText={setHectares} keyboardType="decimal-pad" placeholder="e.g. 4.5" placeholderTextColor="#888" style={styles.input} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Lease land to youth?</Text>
              <Text style={styles.switchSub}>Earn monthly income from your unused land.</Text>
            </View>
            <Switch value={wantsLease} onValueChange={setWantsLease} trackColor={{ false: '#333', true: palette.neon }} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>SUCCESSION (NEXT OF KIN)</Text>
          <Text style={styles.label}>FULL NAME</Text>
          <TextInput value={nextOfKin} onChangeText={setNextOfKin} placeholder="e.g. Chidi Okafor" placeholderTextColor="#888" style={styles.input} />
          
          <Text style={styles.label}>PHONE NUMBER</Text>
          <TextInput value={nokPhone} onChangeText={setNokPhone} keyboardType="phone-pad" placeholder="080..." placeholderTextColor="#888" style={styles.input} />
        </View>

        <Pressable onPress={saveProfile} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnTxt}>SAVE PROFILE</Text>}
        </Pressable>

        {profile?.verified_by_agent ? (
          <View style={styles.verifiedBox}>
            <Text style={styles.verifiedTxt}>✅ Verified by GAIA Agent</Text>
          </View>
        ) : null}
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
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1.5, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: p.obsidian, padding: 14, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  switchTitle: { fontSize: 14, fontWeight: '800', color: p.text },
  switchSub: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  saveBtn: { backgroundColor: p.neon, padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  saveBtnTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  verifiedBox: { marginTop: 16, backgroundColor: 'rgba(0,255,136,0.1)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: p.neon, alignItems: 'center' },
  verifiedTxt: { fontSize: 12, fontWeight: '900', color: p.neon },
});
