import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function FamilyDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [tab, setTab] = useState<'code' | 'family'>('family');
  const [myCode, setMyCode] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState('');
  const [linkedPatients, setLinkedPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [patientData, setPatientData] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);

    // 1. Get my code (if I am a patient)
    const { data: myProfile } = await supabase.from('client_health_profiles').select('family_code').eq('user_id', user.id).maybeSingle();
    if (myProfile?.family_code) setMyCode(myProfile.family_code);

    // 2. Get my linked family members
    const { data: links } = await supabase.from('family_links').select('patient_id').eq('sponsor_id', user.id);
    
    if (links && links.length > 0) {
      const patientIds = links.map((l: any) => l.patient_id);
      // Fetch patient profiles
      const { data: profiles } = await supabase.from('client_health_profiles').select('user_id, condition').in('user_id', patientIds);
      // Fetch patient names from user_profiles
      const { data: users } = await supabase.from('user_profiles').select('user_id, first_name, last_name').in('user_id', patientIds);
      
      const merged = (profiles || []).map(p => {
        const u = (users || []).find(x => x.user_id === p.user_id);
        return {
          ...p,
          name: [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'Loved One'
        };
      });
      setLinkedPatients(merged);
    }

    setBusy(false);
    setRef(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const generateCode = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('generate_family_code');
    if (!error && data) setMyCode(data);
    setBusy(false);
  };

  const linkPatient = async () => {
    if (!linkCode.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc('link_family_member', { p_code: linkCode.trim().toUpperCase() });
    setBusy(false);
    if (error) {
      Alert.alert('Link Failed', error.message);
    } else {
      Alert.alert('Success', 'Patient linked to your account.');
      setLinkCode('');
      load();
    }
  };

  const viewPatient = async (patient: any) => {
    setSelectedPatient(patient);
    setBusy(true);
    const { data, error } = await supabase.rpc('get_family_data', { p_patient_id: patient.user_id });
    setBusy(false);
    if (error) Alert.alert('Error', error.message);
    else setPatientData(data);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Family Care</Text>
        <Text style={styles.sub}>Manage health for your loved ones.</Text>

        <View style={styles.tabBar}>
          <Pressable onPress={() => { setTab('family'); setSelectedPatient(null); }} style={[styles.tabBtn, tab === 'family' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'family' && styles.tabTextOn]}>MY FAMILY</Text>
          </Pressable>
          <Pressable onPress={() => setTab('code')} style={[styles.tabBtn, tab === 'code' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === 'code' && styles.tabTextOn]}>MY CODE</Text>
          </Pressable>
        </View>

        {/* --- TAB 1: SPONSOR VIEW --- */}
        {tab === 'family' && !selectedPatient && (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>LINK A FAMILY MEMBER</Text>
              <TextInput 
                value={linkCode} 
                onChangeText={setLinkCode} 
                placeholder="Enter 6-digit code (e.g. A1B2C3)" 
                placeholderTextColor="#888"
                style={styles.input} 
                autoCapitalize="characters"
                maxLength={6}
              />
              <Pressable onPress={linkPatient} disabled={busy} style={styles.cta}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>LINK PATIENT</Text>}
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>MY PATIENTS</Text>
            {linkedPatients.length === 0 ? (
              <Text style={styles.sub}>No family members linked yet.</Text>
            ) : (
              linkedPatients.map(p => (
                <Pressable key={p.user_id} onPress={() => viewPatient(p)} style={styles.patientCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patientName}>{p.name}</Text>
                    <Text style={styles.patientCondition}>{p.condition}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))
            )}
          </>
        )}

        {/* --- TAB 2: PATIENT VIEW (CODE) --- */}
        {tab === 'code' && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>SHARE THIS CODE</Text>
            <Text style={styles.sub}>Give this code to your child or sponsor so they can monitor your health.</Text>
            
            {myCode ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{myCode}</Text>
              </View>
            ) : (
              <Pressable onPress={generateCode} disabled={busy} style={styles.cta}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaTxt}>GENERATE MY CODE</Text>}
              </Pressable>
            )}
          </View>
        )}

        {/* --- DRILL DOWN: PATIENT DATA --- */}
        {selectedPatient && patientData && (
          <>
            <Pressable onPress={() => setSelectedPatient(null)} style={{ marginBottom: 16 }}>
              <Text style={{ color: palette.textMuted, fontWeight: '700' }}>‹ Back to Family</Text>
            </Pressable>
            
            <Text style={styles.title}>{selectedPatient.name}</Text>
            <Text style={styles.sub}>Condition: {selectedPatient.condition}</Text>

            <Text style={styles.sectionLabel}>RECENT VITALS</Text>
            {patientData.vitals?.length === 0 ? <Text style={styles.sub}>No vitals logged yet.</Text> : null}
            {patientData.vitals?.map((v: any, i: number) => {
              const isHighBP = v.systolic_bp > 140 || v.diastolic_bp > 90;
              const isHighSugar = v.blood_sugar_mgdl > 180;
              return (
                <View key={i} style={[styles.vitalCard, (isHighBP || isHighSugar) && styles.vitalCardAlert]}>
                  <Text style={styles.vitalDate}>{new Date(v.created_at).toLocaleString()}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={[styles.vitalValue, isHighBP && { color: '#ff3b5c' }]}>
                      BP: {v.systolic_bp || '?'}/{v.diastolic_bp || '?'}
                    </Text>
                    <Text style={[styles.vitalValue, isHighSugar && { color: '#ff3b5c' }]}>
                      Sugar: {v.blood_sugar_mgdl || '?'} mg/dL
                    </Text>
                  </View>
                  {(isHighBP || isHighSugar) && (
                    <Text style={styles.alertText}>⚠️ High reading detected! Contact them.</Text>
                  )}
                </View>
              );
            })}

            <Text style={styles.sectionLabel}>RECENT MEAL SCANS</Text>
            {patientData.scans?.length === 0 ? <Text style={styles.sub}>No meals scanned yet.</Text> : null}
            {patientData.scans?.map((s: any, i: number) => (
              <View key={i} style={styles.scanCard}>
                <Text style={styles.vitalDate}>{new Date(s.created_at).toLocaleString()}</Text>
                <Text style={{ fontSize: 12, color: palette.text, marginTop: 8, lineHeight: 18 }}>
                  {s.analysis}
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 20, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnOn: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 10, fontWeight: '900', color: p.textDim, letterSpacing: 1 },
  tabTextOn: { color: p.neon },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1.5, marginBottom: 12, marginTop: 10 },
  input: { backgroundColor: p.obsidian, padding: 16, borderRadius: 12, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 20, textAlign: 'center', letterSpacing: 4, marginBottom: 12 },
  cta: { backgroundColor: p.neon, padding: 16, borderRadius: 12, alignItems: 'center' },
  ctaTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
  patientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  patientName: { fontSize: 16, fontWeight: '900', color: p.text },
  patientCondition: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  chevron: { fontSize: 24, color: p.textDim },
  codeBox: { backgroundColor: 'rgba(0,255,136,0.1)', padding: 24, borderRadius: 16, borderWidth: 2, borderColor: p.neon, alignItems: 'center', marginTop: 12 },
  codeText: { fontSize: 48, fontWeight: '900', color: p.neon, letterSpacing: 8 },
  vitalCard: { backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  vitalCardAlert: { borderColor: '#ff3b5c', backgroundColor: 'rgba(255,59,92,0.05)' },
  vitalDate: { fontSize: 10, color: p.textMuted },
  vitalValue: { fontSize: 14, fontWeight: '900', color: p.text },
  alertText: { fontSize: 11, color: '#ff3b5c', fontWeight: '800', marginTop: 8 },
  scanCard: { backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
});
