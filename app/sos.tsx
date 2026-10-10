import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Alert, ActivityIndicator, Vibration } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

const KINDS = [
  { k: 'medical', label: 'Medical', emoji: '🚑' },
  { k: 'fire',    label: 'Fire',    emoji: '🔥' },
  { k: 'flood',   label: 'Flood',   emoji: '🌊' },
  { k: 'theft',   label: 'Theft',   emoji: '🚨' },
  { k: 'animal',  label: 'Animal',  emoji: '🐍' },
  { k: 'general', label: 'Help',    emoji: '🆘' },
];

export default function SOS() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [kind, setKind] = useState('general');
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<any>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<any>(null);

  const startHold = () => {
    setHolding(true);
    Vibration.vibrate(30);
    let p = 0;
    holdTimer.current = setInterval(() => {
      p += 0.05;
      setProgress(p);
      progressAnim.setValue(p);
      if (p >= 1) {
        clearInterval(holdTimer.current);
        holdTimer.current = null;
        trigger();
      }
    }, 50);
  };

  const cancelHold = () => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
    setProgress(0);
    progressAnim.setValue(0);
  };

  const trigger = async () => {
    setSending(true);
    Vibration.vibrate([0, 200, 100, 200]);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 0, lng = 0;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const { data: alert } = await supabase.rpc('sos_trigger', {
        p_lat: lat, p_lng: lng, p_kind: kind, p_message: null,
      });

      const { data: prof } = await supabase.from('user_profiles')
        .select('first_name,last_name,phone,emergency_contact_phone,emergency_contact_name')
        .eq('user_id', user?.id).maybeSingle();

      const contacts = [];
      if (prof?.emergency_contact_phone) {
        contacts.push({ name: prof.emergency_contact_name || 'Emergency', phone: prof.emergency_contact_phone });
      }

      try {
        const sess = await supabase.auth.getSession();
        const token = sess?.data?.session?.access_token;
        await fetch(API_BASE + '/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: JSON.stringify({
            lat, lng, kind,
            message: null,
            user_email: user?.email,
            user_name: ((prof?.first_name || '') + ' ' + (prof?.last_name || '')).trim(),
            emergency_contacts: contacts,
          }),
        });
      } catch {}

      setSent({ alert, contacts: contacts.length });
    } catch (e: any) {
      Alert.alert('SOS failed', e?.message || 'Try again');
    }
    setSending(false);
    setHolding(false);
    setProgress(0);
  };

  if (sent) {
    return (
      <LinearGradient colors={['#1a0a0a', '#3d1414', '#1a0a0a']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.sentEmoji}>🆘</Text>
          <Text style={styles.sentTitle}>SOS SENT</Text>
          <Text style={styles.sentSub}>
            {sent.contacts} emergency contact{sent.contacts !== 1 ? 's' : ''} notified
          </Text>
          <Text style={styles.sentMeta}>Your location has been shared.</Text>
          <Pressable onPress={() => router.back()} style={styles.doneBtn}>
            <Text style={styles.doneTxt}>DONE</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a0a0a', '#3d1414', '#1a0a0a']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <View style={styles.inner}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        <Text style={styles.kicker}>EMERGENCY</Text>
        <Text style={styles.title}>Send SOS</Text>
        <Text style={styles.sub}>
          Choose the emergency, then hold the button for 3 seconds.
          Alerts go to your emergency contacts + GAIA with your GPS.
        </Text>

        <View style={styles.kindGrid}>
          {KINDS.map((k) => (
            <Pressable key={k.k} onPress={() => setKind(k.k)}
              style={[styles.kindChip, kind === k.k && styles.kindChipOn]}>
              <Text style={styles.kindEmoji}>{k.emoji}</Text>
              <Text style={[styles.kindTxt, kind === k.k && styles.kindTxtOn]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.holdWrap}>
          <Pressable
            onPressIn={startHold}
            onPressOut={cancelHold}
            style={styles.sosBtnWrap}
          >
            <Animated.View style={[styles.progressRing, {
              transform: [{ scale: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
              opacity: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            }]} />
            <View style={styles.sosBtn}>
              {sending ? <ActivityIndicator color="#fff" size="large" /> : (
                <>
                  <Text style={styles.sosTxt}>SOS</Text>
                  <Text style={styles.sosHint}>{holding ? Math.round(progress * 100) + '%' : 'HOLD 3s'}</Text>
                </>
              )}
            </View>
          </Pressable>
        </View>

        <Text style={styles.warn}>
          Only use in a real emergency. Your location and selected emergency type will be sent.
        </Text>
      </View>
    </LinearGradient>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 20, paddingTop: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', marginBottom: 12 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 3, color: '#ff3b5c' },
  title: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -1.5, marginTop: 6 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 12, lineHeight: 19 },
  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 28 },
  kindChip: { width: '31%', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center' },
  kindChipOn: { borderColor: '#ff3b5c', backgroundColor: 'rgba(255,59,92,0.15)' },
  kindEmoji: { fontSize: 24 },
  kindTxt: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.6)', marginTop: 4, letterSpacing: 0.5 },
  kindTxtOn: { color: '#ff3b5c' },
  holdWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sosBtnWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  progressRing: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,59,92,0.25)' },
  sosBtn: { width: 180, height: 180, borderRadius: 90, backgroundColor: '#ff3b5c', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff3b5c', shadowOpacity: 0.7, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  sosTxt: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: 4 },
  sosHint: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 2, marginTop: 2 },
  warn: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 15, marginTop: 20 },
  sentEmoji: { fontSize: 80 },
  sentTitle: { fontSize: 32, fontWeight: '900', color: '#ff3b5c', letterSpacing: -1, marginTop: 12 },
  sentSub: { fontSize: 15, color: '#fff', marginTop: 8, fontWeight: '700' },
  sentMeta: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  doneBtn: { marginTop: 40, paddingHorizontal: 60, paddingVertical: 16, borderRadius: 14, backgroundColor: '#ff3b5c' },
  doneTxt: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
});
