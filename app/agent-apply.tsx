import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const API = 'https://gaia-api-xuly.onrender.com';
const STATES = ['Kaduna','Kano','Katsina','Niger','Plateau','Bauchi','Zamfara','Sokoto','Jigawa','Kebbi','Kwara','Nasarawa','Benue','FCT Abuja'];

export default function AgentApply() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('Kaduna');
  const [lga, setLga] = useState('');
  const [zone, setZone] = useState('');
  const [organization, setOrganization] = useState('');
  const [experience, setExperience] = useState('');
  const [motivation, setMotivation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!fullName || !email || !phone) {
      Alert.alert('Missing', 'Name, email, and phone are required.');
      return;
    }
    setBusy(true);
    try {
      const r = await supabase.rpc('agent_apply', {
        p_full_name: fullName.trim(),
        p_email: email.trim(),
        p_phone: phone.trim(),
        p_state: state,
        p_lga: lga || null,
        p_zone: zone || null,
        p_organization: organization || null,
        p_experience_years: parseInt(experience) || 0,
        p_motivation: motivation || null,
      });
      setBusy(false);
      if (r.error) {
        Alert.alert('Failed', r.error.message);
        return;
      }
      setDone(true);
    } catch (e: any) {
      setBusy(false);
      Alert.alert('Failed', e.message);
    }
  };

  if (done) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>OK</Text>
            <Text style={styles.doneTitle}>Application received</Text>
            <Text style={styles.doneBody}>
              Our team will review your application and contact you on {phone} or {email}.
            </Text>
            <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.cta}>
              <Text style={styles.ctaText}>BACK TO LOGIN</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Become a GAIA Agent</Text>
        <Text style={styles.sub}>Register farmers in your area and earn N500 per approved verification.</Text>

        <Text style={styles.label}>FULL NAME *</Text>
        <TextInput value={fullName} onChangeText={setFullName} placeholder="e.g. Ibrahim Yusuf" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>EMAIL *</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>PHONE *</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="08031234567" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>STATE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {STATES.map((s) => (
            <Pressable key={s} onPress={() => setState(s)} style={[styles.chip, state === s && styles.chipOn]}>
              <Text style={[styles.chipText, state === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>LGA</Text>
        <TextInput value={lga} onChangeText={setLga} placeholder="e.g. Zaria" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>ZONE</Text>
        <TextInput value={zone} onChangeText={setZone} placeholder="e.g. Kaduna North" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>ORGANIZATION</Text>
        <TextInput value={organization} onChangeText={setOrganization} placeholder="e.g. BOA Kaduna" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>YEARS OF EXPERIENCE</Text>
        <TextInput value={experience} onChangeText={setExperience} keyboardType="number-pad" placeholder="0" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>WHY DO YOU WANT TO BE AN AGENT?</Text>
        <TextInput value={motivation} onChangeText={setMotivation} multiline style={[styles.input, { minHeight: 100 }]} placeholder="Tell us about your experience and goals..." placeholderTextColor={palette.textDim} />

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>SUBMIT APPLICATION</Text>}
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chips: { gap: 6, paddingRight: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 24 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  doneBox: { padding: 30, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.neon, alignItems: 'center', marginTop: 60 },
  doneIcon: { fontSize: 20, fontWeight: '900', color: p.neon, letterSpacing: 2 },
  doneTitle: { fontSize: 22, fontWeight: '900', color: p.text, marginTop: 12 },
  doneBody: { fontSize: 13, color: p.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
