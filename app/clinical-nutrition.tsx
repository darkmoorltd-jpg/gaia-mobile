import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { MarkdownOutput } from '../src/components/MarkdownOutput';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

export default function ClinicalNutrition() {
  const router = useRouter();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles();
  const scrollRef = useRef<ScrollView>(null);

  const [tab, setTab] = useState<'clinic' | 'chat'>('clinic');
  const [loading, setLoading] = useState(true);
  const [hasSub, setHasSub] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [scanCredits, setScanCredits] = useState<number | null>(null);

  // Vitals
  const [sugar, setSugar] = useState('');
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [saving, setSaving] = useState(false);

  // Scanner
  const [mealImage, setMealImage] = useState<string | null>(null);
  const [mealAnalysis, setMealAnalysis] = useState<string | null>(null);
  const [scanningMeal, setScanningMeal] = useState(false);

  // Chat
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [sub, h, p] = await Promise.all([
      supabase.from('care_subscriptions').select('status, scan_credits').eq('user_id', user.id).maybeSingle(),
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

  const speak = (text: string) => {
    Speech.speak(text, { language: 'en-NG', rate: 0.9 });
  };

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
          user_id: user.id, blood_sugar_mgdl: Number(sugar) || null,
          systolic_bp: Number(sys) || null, diastolic_bp: Number(dia) || null
        })
      });
      if (!res.ok) throw new Error('Failed to log vitals');
      Alert.alert('Vitals Logged', 'Dr. Vinc is analyzing your data...');
      setSugar(''); setSys(''); setDia('');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Check internet');
    } finally { setSaving(false); }
  };

  const scanMeal = async () => {
    try {
      const { data, error } = await supabase.rpc('consume_scan_credit');
      if (error) throw error;
      setScanCredits(data.remaining_scans);
    } catch (e: any) {
      Alert.alert('No Scans Left', 'Upgrade your plan to keep scanning.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push('/care-subscribe' as any) }
      ]);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission required'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (res.canceled) return;

    const uri = res.assets[0].uri;
    setMealImage(uri); setMealAnalysis(null); setScanningMeal(true);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const upload = await FileSystem.uploadAsync(API_BASE + '/clinical/analyze-meal', uri, {
        httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file', mimeType: 'image/jpeg',
        headers: { Authorization: 'Bearer ' + token },
        parameters: { condition: health.condition },
      });
      if (upload.status !== 200) throw new Error(`HTTP ${upload.status}`);
      const data = JSON.parse(upload.body);
      setMealAnalysis(data.analysis);
      await supabase.from('meal_scans').insert({ user_id: user.id, condition: health.condition, analysis: data.analysis });
      speak("I have analyzed your meal. Please read the report.");
    } catch (e: any) {
      Alert.alert('Scan Failed', e.message || 'Check internet');
    } finally { setScanningMeal(false); }
  };

  const sendChat = async () => {
    if (!input.trim() || chatBusy) return;
    const q = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setChatBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd(), 100);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(API_BASE + '/clinical/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ message: q, history: messages.slice(-5), language: 'en' })
      });
      if (!res.ok) throw new Error('Chat failed');
      const data = await res.json();
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      speak(data.reply);
    } catch (e: any) {
      Alert.alert('Error', 'Could not reach Dr. Vinc.');
    } finally {
      setChatBusy(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#16a34a" /></View>;

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
        <Text style={styles.sub}>Let Dr. Vinc know your condition.</Text>
        <Pressable onPress={() => router.push('/clinical-onboarding' as any)} style={styles.cta}><Text style={styles.ctaTxt}>START ONBOARDING</Text></Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Dr. Vinc's Clinic</Text>
        <Text style={styles.sub}>Managing: <Text style={{color: '#16a34a', fontWeight: '800'}}>{health.condition}</Text></Text>
        
        <View style={styles.tabBar}>
          <Pressable onPress={() => setTab('clinic')} style={[styles.tabBtn, tab === 'clinic' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'clinic' && styles.tabTextOn]}>MY CLINIC</Text>
          </Pressable>
          <Pressable onPress={() => setTab('chat')} style={[styles.tabBtn, tab === 'chat' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'chat' && styles.tabTextOn]}>CHAT / VOICE</Text>
          </Pressable>
        </View>
      </View>

      {tab === 'clinic' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={{ padding: 10, backgroundColor: '#fef2f2', borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#fecaca' }}>
            <Text style={{ fontSize: 10, color: '#b91c1c', textAlign: 'center', fontWeight: '600' }}>⚕️ Dr. Vinc is an AI. Consult your physician for medical decisions.</Text>
          </View>

          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={styles.sectionLabel}>📷 PRECISION MEAL SCANNER</Text>
              <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: '700' }}>{scanCredits > 9000 ? 'Unlimited' : `${scanCredits} scans left`}</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>Dr. Vinc calculates the exact weight of each item (rice, oil, beans) in grams and estimates macros precisely.</Text>
            {mealImage ? <Image source={{ uri: mealImage }} style={{ width: '100%', height: 180, borderRadius: 12, marginBottom: 12 }} /> : null}
            {scanningMeal ? <ActivityIndicator color="#16a34a" style={{ marginVertical: 10 }} /> : null}
            {mealAnalysis ? (
              <View style={{ backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 12 }}>
                <MarkdownOutput content={mealAnalysis} />
              </View>
            ) : null}
            <Pressable onPress={scanMeal} disabled={scanningMeal} style={[styles.cta, { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#16a34a' }]}>
              <Text style={[styles.ctaTxt, { color: '#16a34a' }]}>SCAN MEAL WITH CAMERA</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>DAILY CHECK-IN</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>BLOOD SUGAR (mg/dL)</Text>
                <TextInput value={sugar} onChangeText={setSugar} keyboardType="numeric" style={styles.input} placeholder="95" placeholderTextColor="#94a3b8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>BP (Sys/Dia)</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput value={sys} onChangeText={setSys} keyboardType="numeric" style={{...styles.input, flex: 1}} placeholder="120" placeholderTextColor="#94a3b8" />
                  <TextInput value={dia} onChangeText={setDia} keyboardType="numeric" style={{...styles.input, flex: 1}} placeholder="80" placeholderTextColor="#94a3b8" />
                </View>
              </View>
            </View>
            <Pressable onPress={logVitals} disabled={saving} style={styles.cta}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>LOG VITALS</Text>}
            </Pressable>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.chatScroll}>
            {messages.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>🩺</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>Ask Dr. Vinc anything</Text>
                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>I can help calculate food weights, macros, or advise on your condition.</Text>
              </View>
            ) : null}
            {messages.map((m, i) => (
              <View key={i} style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
                {m.role === 'assistant' ? <MarkdownOutput content={m.content} /> : <Text style={{ color: '#fff', fontSize: 14 }}>{m.content}</Text>}
              </View>
            ))}
            {chatBusy ? <ActivityIndicator color="#16a34a" style={{ marginTop: 10 }} /> : null}
          </ScrollView>
          <View style={styles.inputBar}>
            <TextInput value={input} onChangeText={setInput} placeholder="Ask about weight, oil, carbs..." placeholderTextColor="#94a3b8" style={styles.chatInput} multiline />
            <Pressable onPress={sendChat} disabled={chatBusy} style={styles.sendBtn}>
              <Text style={{ color: '#fff', fontWeight: '900' }}>Send</Text>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  scroll: { padding: 20 },
  center: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', padding: 20 },
  back: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: '#0f172a', letterSpacing: -1 },
  sub: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 12 },
  tabBar: { flexDirection: 'row', gap: 6, marginTop: 16, backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnOn: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  tabText: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1 },
  tabTextOn: { color: '#16a34a' },
  card: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: '#16a34a', letterSpacing: 1.5, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', color: '#64748b', marginBottom: 4 },
  input: { backgroundColor: '#f1f5f9', padding: 14, borderRadius: 10, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  cta: { backgroundColor: '#16a34a', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  ctaTxt: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  chatScroll: { padding: 20, paddingBottom: 20 },
  bubble: { padding: 14, borderRadius: 16, marginBottom: 10, maxWidth: '85%' },
  bubbleUser: { backgroundColor: '#16a34a', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAi: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  inputBar: { flexDirection: 'row', padding: 12, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 8 },
  chatInput: { flex: 1, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 20, maxHeight: 100, color: '#0f172a' },
  sendBtn: { backgroundColor: '#16a34a', paddingHorizontal: 20, borderRadius: 20, justifyContent: 'center' },
});
