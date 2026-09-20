import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function AddFriend() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [message, setMessage] = useState('');

  const search = async () => {
    setBusy(true);
    setMessage('');
    setResult(null);
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('user_id,email,first_name,last_name')
        .ilike('email', email.trim().toLowerCase())
        .maybeSingle();

      if (!data) {
        setMessage('No user found with that email');
      } else if (data.user_id === user?.id) {
        setMessage("That's you!");
      } else {
        setResult(data);
      }
    } catch (e) {
      setMessage('Search failed');
    } finally {
      setBusy(false);
    }
  };

  const sendRequest = async () => {
    if (!result || !user) return;
    setBusy(true);
    try {
      await supabase.from('friendships').insert({
        sender_id: user.id,
        receiver_id: result.user_id,
        status: 'pending',
      });
      setMessage('Friend request sent!');
      setResult(null);
      setEmail('');
    } catch (e: any) {
      setMessage(e?.message || 'Could not send request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <Text style={styles.title}>Add a friend</Text>
        <Text style={styles.sub}>Search by the email they used to sign up.</Text>

        <View style={styles.searchWrap}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="friend@email.com"
            placeholderTextColor={palette.textDim}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <Pressable
          onPress={search}
          disabled={!email.trim() || busy}
          style={[styles.cta, (!email.trim() || busy) && { opacity: 0.5 }]}
        >
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>SEARCH</Text>}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {result ? (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(result.first_name?.[0] || result.email[0]).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {((result.first_name || '') + ' ' + (result.last_name || '')).trim() ||
                  result.email.split('@')[0]}
              </Text>
              <Text style={styles.email}>{result.email}</Text>
            </View>
            <Pressable onPress={sendRequest} style={styles.addBtn}>
              <Text style={styles.addBtnText}>ADD</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.obsidian },
    scroll: { padding: spacing.xl, paddingTop: 60 },
    back: { ...typography.micro, color: palette.textMuted, marginBottom: spacing.lg },
    title: { fontSize: 32, fontWeight: '900', color: palette.text, letterSpacing: -1 },
    sub: { ...typography.body, color: palette.textMuted, marginTop: 6, marginBottom: spacing.xl },
    searchWrap: {
      borderWidth: 1.5, borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
    },
    input: { paddingVertical: 14, color: palette.text, fontSize: 16 },
    cta: {
      marginTop: spacing.lg,
      padding: 18,
      borderRadius: radius.md,
      backgroundColor: palette.neon,
      alignItems: 'center',
    },
    ctaText: { fontSize: 15, fontWeight: '900', color: palette.obsidian, letterSpacing: 1 },
    message: { ...typography.caption, color: palette.warning, textAlign: 'center', marginTop: spacing.lg },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.borderHi,
      marginTop: spacing.xl,
    },
    avatar: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: palette.neonSoft,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 20, fontWeight: '900', color: palette.neon },
    name: { ...typography.body, fontWeight: '700', color: palette.text },
    email: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
    addBtn: {
      paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: palette.neon,
    },
    addBtnText: { fontSize: 12, fontWeight: '900', color: palette.obsidian },
  });
