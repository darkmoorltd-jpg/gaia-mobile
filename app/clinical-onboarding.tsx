import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const CONDITIONS = ['Diabetes', 'Hypertension', 'Pregnant', 'Breastfeeding', 'Elderly', 'Cancer Recovery'];

export default function ClinicalOnboarding() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [condition, setCondition] = useState('');
  const [weight, setWeight] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!condition) { Alert.alert('Error', 'Please select your health condition.'); return; }
    setBusy(true);

    // 1. Save Health Profile
    const { error } = await supabase.from('client_health_profiles').insert({
      user_id: user.id,
      condition: condition,
      current_weight_kg: Number(weight) || null,
      dietary_restrictions: restrictions ? restrictions.split(',').map(s => s.trim()) : [],
    });

    if (error) {
      Alert.alert('Error', error.message);
      setBusy(false);
      return;
    }

    // 2. Generate initial meal plan
    await supabase.from('meal_plans').insert({
      user_id: user.id,
      plan_name: `${condition} Starter Plan`,
      daily_calories: 2000,
      foods: ['Brown Rice', 'Beans', 'Vegetables', 'Grilled Chicken'],
      ai_instructions: `Welcome to GAIA. I have designed this starter plan for your ${condition.toLowerCase()}. We will refine it as we track your vitals.`,
      is_active: true
    });

    setBusy(false);
    Alert.alert('Welcome to Dr. Vinc\'s Clinic', 'Your health profile has been created.');
    router.replace('/clinical-nutrition');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <Text style={styles.title}>Health Setup</Text>
        <Text style={styles.subtitle}>Dr. Vinc needs this info to design your diet.</Text>

        <Text style={styles.label}>WHAT IS YOUR HEALTH CONDITION?</Text>
        <View style={styles.conditionGrid}>
          {CONDITIONS.map(c => (
            <Pressable key={c} onPress={() => setCondition(c)} style={[styles.conditionBtn, condition === c && styles.conditionActive]}>
              <Text style={[styles.conditionTxt, condition === c && { color: '#000' }]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>CURRENT WEIGHT (KG) - OPTIONAL</Text>
        <TextInput value={weight} onChangeText={setWeight} keyboardType="numeric" style={styles.input} placeholder="e.g. 65" placeholderTextColor="#888" />

        <Text style={styles.label}>DIETARY RESTRICTIONS (COMMA SEPARATED)</Text>
        <TextInput value={restrictions} onChangeText={setRestrictions} style={styles.input} placeholder="e.g. low-GI, no-nuts, low-sodium" placeholderTextColor="#888" />

        <Pressable onPress={save} disabled={busy} style={styles.cta}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>SAVE & ENTER CLINIC</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 20, marginBottom: 8 },
  conditionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  conditionBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  conditionActive: { backgroundColor: p.neon, borderColor: p.neon },
  conditionTxt: { fontSize: 13, fontWeight: '700', color: p.textMuted },
  input: { backgroundColor: p.surface, padding: 16, borderRadius: 12, color: p.text, borderWidth: 1, borderColor: p.border },
  cta: { backgroundColor: p.neon, padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 32 },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
