import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

function normalizePhone(input: string): string {
  let p = (input || '').trim().replace(/[\s\-\(\)]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '234' + p.slice(1);
  else if (!p.startsWith('234')) p = '234' + p;
  return p;
}

export default function AddFriend() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [message, setMessage] = useState('');

  const search = async () => {
    const raw = query.trim();
    if (!raw) return;

    setBusy(true);
    setMessage('');
    setResult(null);

    try {
      let data: any = null;

      if (mode === 'email') {
        const { data: found } = await supabase
          .from('user_profiles')
          .select('user_id,email,phone,first_name,last_name')
          .ilike('email', raw.toLowerCase())
          .maybeSingle();
        data = found;
      } else {
        const norm = normalizePhone(raw);
        const { data: found } = await supabase
          .from('user_profiles')
          .select('user_id,email,phone,first_name,last_name')
          .eq('phone', norm)
          .maybeSingle();
        data = found;
      }

      if (!data) {
        setMessage(
          mode === 'email'
            ? 'No user found with that email'
            : 'No user found with that phone number',
        );
      } else if (data.user_id === user?.id) {
        setMessage("That's you!");
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setMessage(e?.message || 'Search failed');
    } finally {
      setBusy(false);
    }
  };

  const sendRequest = async () => {
    if (!result || !user) return;
    setBusy(true);
    try {
      const { data: existing } = await supabase
        .from('friendships')
        .select('id,status')
        .or(
          'and(sender_id.eq.' + user.id + ',receiver_id.eq.' + result.user_id + '),' +
          'and(sender_id.eq.' + result.user_id + ',receiver_id.eq.' + user.id + ')',
        )
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') {
          setMessage('You are already friends.');
        } else if (existing.status === 'pending') {
          setMessage('Friend request already pending.');
        } else {
          await supabase
            .from('friendships')
            .update({ status: 'pending', sender_id: user.id })
            .eq('id', existing.id);
          setMessage('Friend request re-sent!');
        }
        setBusy(false);
        return;
      }

      await supabase.from('friendships').insert({
        sender_id: user.id,
        receiver_id: result.user_id,
        status: 'pending',
      });
      setMessage('Friend request sent!');
      setResult(null);
      setQuery('');
    } catch (e: any) {
      setMessage(e?.message || 'Could not send request');
    } finally {
      setBusy(false);
    }
  };

  const displayName = (r: any) => {
    const full = ((r.first_name || '') + ' ' + (r.last_name || '')).trim();
    if (full) return full;
    if (r.email) return r.email.split('@')[0];
    return 'Farmer';
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <Text style={styles.title}>Add a friend</Text>
        <Text style={styles.sub}>Search by email or phone number.</Text>

        <View style={styles.tabs}>
          <Pressable
            onPress={() => setMode('email')}
            style={[styles.tab, mode === 'email' && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === 'email' && styles.tabTextActive]}>
              EMAIL
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('phone')}
            style={[styles.tab, mode === 'phone' && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === 'phone' && styles.tabTextActive]}>
              PHONE
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={mode === 'email' ? 'friend@email.com' : '0803 123 4567'}
            placeholderTextColor={palette.textDim}
            style={styles.input}
            autoCapitalize="none"
            keyboardType={mode === 'email' ? 'email-address' : 'phone-pad'}
          />
        </View>

        <Pressable
          onPress={search}
          disabled={!query.trim() || busy}
          style={[styles.cta, (!query.trim() || busy) && styles.ctaDisabled]}
        >
          {busy ? (
            <ActivityIndicator color={palette.obsidian} />
          ) : (
            <Text style={styles.ctaText}>SEARCH</Text>
          )}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {result ? (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName(result).charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.name}>{displayName(result)}</Text>
              <Text style={styles.email}>{result.email}</Text>
              {result.phone ? (
                <Text style={styles.phone}>+{result.phone}</Text>
              ) : null}
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
    container: {
      flex: 1,
      backgroundColor: palette.obsidian,
    },
    scroll: {
      padding: spacing.xl,
      paddingTop: 60,
    },
    back: {
      ...typography.micro,
      color: palette.textMuted,
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: 32,
      fontWeight: '900',
      color: palette.text,
      letterSpacing: -1,
    },
    sub: {
      ...typography.body,
      color: palette.textMuted,
      marginTop: 6,
      marginBottom: spacing.lg,
    },
    tabs: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: palette.neonSoft,
      borderColor: palette.borderHi,
    },
    tabText: {
      ...typography.micro,
      color: palette.textMuted,
    },
    tabTextActive: {
      color: palette.neon,
    },
    searchWrap: {
      borderWidth: 1.5,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
    },
    input: {
      paddingVertical: 14,
      color: palette.text,
      fontSize: 16,
    },
    cta: {
      marginTop: spacing.lg,
      padding: 18,
      borderRadius: radius.md,
      backgroundColor: palette.neon,
      alignItems: 'center',
    },
    ctaDisabled: {
      opacity: 0.5,
    },
    ctaText: {
      fontSize: 15,
      fontWeight: '900',
      color: palette.obsidian,
      letterSpacing: 1,
    },
    message: {
      ...typography.caption,
      color: palette.warning,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.borderHi,
      marginTop: spacing.xl,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: palette.neonSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 20,
      fontWeight: '900',
      color: palette.neon,
    },
    cardBody: {
      flex: 1,
    },
    name: {
      ...typography.body,
      fontWeight: '700',
      color: palette.text,
    },
    email: {
      ...typography.caption,
      color: palette.textMuted,
      marginTop: 2,
    },
    phone: {
      ...typography.caption,
      color: palette.neon,
      marginTop: 2,
    },
    addBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: palette.neon,
    },
    addBtnText: {
      fontSize: 12,
      fontWeight: '900',
      color: palette.obsidian,
    },
  });
