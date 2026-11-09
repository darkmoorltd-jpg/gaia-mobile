import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { MarkdownOutput } from '../src/components/MarkdownOutput';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export default function ClinicalNutrition() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [loading, setLoading] = useState(true);
  const [hasSub, setHasSub] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  
  const [sugar, setSugar] = useState('');
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [saving, setSaving] = useState(false);

  // Meal Scan States
  const [mealImage, setMealImage] = useState<string | null>(null);
  const [mealAnalysis, setMealAnalysis] = useState<string | null>(null);
  const [scanningMeal, setScanningMeal] = useState(false);
  const [scanCredits, setScanCredits] = useState<number | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [sub, h, p] = await Promise.all([
      supabase.from('care_subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
      supabase.from('client_health_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('meal_plans').select('*').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    ]);
    setHasSub(sub.data?.status === 'active');
    if (sub.data) setScanCredits(sub.data.scan_credits);
    setHealth(h.data);
    setPlan(p.data);
    setLoading(false);
  };

  useFocusEffect(React.useCallback(() => { load(); }, [user]));

  const logVitals = async () => {
    if (!sugar && !sys && !dia) { Alert.alert('Enter at least one vital sign'); return; }
    setSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(API_BASE + '/clinical/log-vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          user_id: user.id,
          blood_sugar_mgdl: Number(sugar) || null,
          systolic_bp: Number(sys) || null,
          diastolic_bp: Number(dia) || null
        })
      });

      if (!res.ok) throw new Error('Failed to log vitals');

      Alert.alert('Vitals Logged', 'Dr. Vinc is analyzing your data...');
      setSugar(''); setSys(''); setDia('');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Check internet');
    } finally {
      setSaving(false);
    }
  };

  const scanMeal = async () => {
    // 1. Check & consume scan credit in DB
    try {
      const { data, error } = await supabase.rpc('consume_scan_credit');
      if (error) throw error;
      setScanCredits(data.remaining_scans);
    } catch (e: any) {
      Alert.alert(
        'No Scans Left',
        'You have used all your meal scans for this month. Upgrade your plan to keep scanning.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/care-subscribe' as any) }
        ]
      );
      return;
    }

    // 2. Open Camera
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission required'); return; }

    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (res.canceled) return;

    const uri = res.assets[0].uri;
    setMealImage(uri);
    setMealAnalysis(null);
    setScanningMeal(true);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const upload = await FileSystem.uploadAsync(API_BASE + '/clinical/analyze-meal', uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: 'image/jpeg',
        headers: { Authorization: 'Bearer ' + token },
        parameters: { condition: health.condition },
      });

      if (upload.status !== 200) throw new Error(`HTTP ${upload.status}`);
      const data = JSON.parse(upload.body);
      setMealAnalysis(data.analysis);

      // Save to DB for Admin panel
      await supabase.from('meal_scans').insert({
        user_id: user.id,
        condition: health.condition,
        analysis: data.analysis
      });
    } catch (e: any) {
      Alert.alert('Scan Failed', e.message || 'Check internet');
    } finally {
      setScanningMeal(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  if (!hasSub) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Access Restricted</Text>
        <Text style={[styles.sub, { textAlign: 'center', marginBottom: 20 }]}>You need an active care plan to access Dr. Vinc's Clinic.</Text>
        <Pressable onPress={() => router.push('/care-subscribe' as any)} style={styles.cta}><Text style={styles.ctaTxt}>VIEW CARE PLANS</Text></Pressable>
      </View>
    );
  }

  if (!health) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Setup Required</Text>
        <Text style={styles.sub}>Let Dr. Vinc know your condition to create your diet.</Text>
        <Pressable onPress={() => router.push('/clinical-onboarding' as any)} style={styles.cta}><Text style={styles.ctaTxt}>START ONBOARDING</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <Text style={styles.title}>Dr. Vinc's Clinic</Text>
        <Text style={styles.sub}>Managing your: <Text style={{color: palette.neon}}>{health.condition}</Text></Text>

        {/* MEDICAL DISCLAIMER */}
        <View style={{ padding: 10, backgroundColor: 'rgba(255,59,92,0.08)', borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 10, color: '#ff3b5c', textAlign: 'center' }}>
            ⚕️ Dr. Vinc is an AI nutritionist. Always consult your physician for medical decisions.
          </Text>
        </View>

        {/* MEAL SCANNER */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>📷 AI MEAL SCANNER</Text>
            <Text style={{ fontSize: 11, color: palette.neon, fontWeight: '700' }}>
              {scanCredits !== null ? `${scanCredits} scans left` : ''}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 12 }}>
            Snap your food. Dr. Vinc will evaluate the portion and give advice for your {health.condition}.
          </Text>

          {mealImage ? <Image source={{ uri: mealImage }} style={{ width: '100%', height: 180, borderRadius: 12, marginBottom: 12 }} /> : null}

          {scanningMeal ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 }}>
              <ActivityIndicator color={palette.neon} />
              <Text style={{ color: palette.textMuted }}>Dr. Vinc is evaluating your meal...</Text>
            </View>
          ) : null}

          {mealAnalysis ? (
            <View style={{ backgroundColor: 'rgba(0,255,136,0.06)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)', marginBottom: 12 }}>
              <MarkdownOutput content={mealAnalysis} />
            </View>
          ) : null}

          <Pressable onPress={scanMeal} disabled={scanningMeal} style={[styles.orderBtn, { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.neon }]}>
            <Text style={[styles.orderTxt, { color: palette.neon }]}>SCAN MEAL WITH CAMERA</Text>
          </Pressable>
        </View>

        {/* VITALS LOGGER */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>DAILY CHECK-IN</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>BLOOD SUGAR (mg/dL)</Text>
              <TextInput value={sugar} onChangeText={setSugar} keyboardType="numeric" style={styles.input} placeholder="e.g. 95" placeholderTextColor="#888" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>BP (Sys/Dia)</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TextInput value={sys} onChangeText={setSys} keyboardType="numeric" style={{...styles.input, flex: 1}} placeholder="120" placeholderTextColor="#888" />
                <TextInput value={dia} onChangeText={setDia} keyboardType="numeric" style={{...styles.input, flex: 1}} placeholder="80" placeholderTextColor="#888" />
              </View>
            </View>
          </View>
          <Pressable onPress={logVitals} disabled={saving} style={styles.cta}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>LOG VITALS TO DR. VINC</Text>}
          </Pressable>
        </View>

        {/* DR. VINC'S MEAL PLAN */}
        <Text style={styles.sectionLabel}>YOUR WEEKLY PRESCRIPTION</Text>
        {plan ? (
          <View style={styles.card}>
            <Text style={styles.planName}>{plan.plan_name}</Text>
            <Text style={styles.planCal}>{plan.daily_calories} kcal / day</Text>
            <View style={styles.foodsList}>
              {plan.foods.map((food: string, i: number) => (
                <Text key={i} style={styles.foodItem}>• {food}</Text>
              ))}
            </View>
            <Text style={styles.aiInstructions}>"{plan.ai_instructions}"</Text>
            <Pressable style={styles.orderBtn}>
              <Text style={styles.orderTxt}>🛒 ORDER THIS WEEK'S BOX</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.sub}>Dr. Vinc hasn't created your plan yet.</Text>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: p.obsidian, justifyContent: 'center', alignItems: 'center', padding: 20 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1.5, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginBottom: 4 },
  input: { backgroundColor: p.obsidian, padding: 14, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border },
  cta: { backgroundColor: p.neon, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  ctaTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
  planName: { fontSize: 18, fontWeight: '900', color: '#ffd700' },
  planCal: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 12 },
  foodsList: { backgroundColor: p.obsidian, padding: 12, borderRadius: 8, marginBottom: 12 },
  foodItem: { fontSize: 14, color: p.text, marginBottom: 6 },
  aiInstructions: { fontSize: 13, color: p.textMuted, fontStyle: 'italic', lineHeight: 20, marginBottom: 16 },
  orderBtn: { backgroundColor: '#ffd700', padding: 16, borderRadius: 12, alignItems: 'center' },
  orderTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
