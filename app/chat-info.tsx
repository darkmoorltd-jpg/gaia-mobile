import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, ActivityIndicator, Linking } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { blockUser, listBlockedIds } from '../src/utils/friends';

export default function ChatInfo() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);
  const [profile, setProfile] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [starCount, setStarCount] = useState(0);
  const [busy, setBusy] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  const load = useCallback(async () => {
    if (!user || !uid) return;
    setBusy(true);
    try {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('user_id,email,first_name,last_name,avatar_url,phone,state,lga,primary_crops')
        .eq('user_id', uid)
        .maybeSingle();
      setProfile(prof || null);

      const { data: rid } = await supabase.rpc('get_or_create_dm', { other_user_id: uid });
      const roomId = rid as unknown as string;

      if (roomId) {
        const { data: imgs } = await supabase
          .from('chat_messages')
          .select('id,attachment_url,created_at,sender_id')
          .eq('room_id', roomId)
          .eq('attachment_type', 'image')
          .order('created_at', { ascending: false })
          .limit(30);
        setMedia(imgs || []);

        const { data: sids } = await supabase
          .from('chat_stars')
          .select('message_id')
          .eq('user_id', user.id)
          .eq('room_id', roomId);
        setStarCount((sids || []).length);
      }

      const blocked = await listBlockedIds(user.id);
      setIsBlocked(blocked.includes(String(uid)));
    } catch (e) { console.log('chat-info error', e); }
    setBusy(false);
  }, [user, uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleBlock = async () => {
    if (!user || !uid) return;
    const target = uid as string;
    const action = isBlocked ? 'Unblock' : 'Block';
    Alert.alert(action + ' ' + (profile?.first_name || 'user') + '?',
      isBlocked ? 'They will be able to message you again.' : 'They will be removed from friends and cannot message you.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: action, style: isBlocked ? 'default' : 'destructive', onPress: async () => {
          try {
            if (isBlocked) {
              await supabase.from('user_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', target);
              setIsBlocked(false);
            } else {
              await blockUser(user.id, target);
              setIsBlocked(true);
            }
          } catch (e) { Alert.alert('Failed'); }
        }},
      ]);
  };

  const reportUser = () => {
    if (!user || !uid) return;
    const reasons = ['Spam', 'Harassment', 'Fake account', 'Scam / fraud', 'Inappropriate content', 'Other'];
    Alert.alert('Report user', 'Choose a reason', [
      ...reasons.map((r) => ({
        text: r,
        onPress: async () => {
          try {
            await supabase.from('user_reports').insert({
              reporter_id: user.id,
              reported_id: uid,
              reason: r,
            });
            Alert.alert('Reported', 'Our team will review this.');
          } catch (e) { Alert.alert('Failed', 'Try again'); }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (busy) {
    return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={palette.neon} /></View>;
  }

  const name = profile ? (((profile.first_name || '') + ' ' + (profile.last_name || '')).trim() || (profile.email ? profile.email.split('@')[0] : 'Farmer')) : 'Farmer';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        <View style={styles.hero}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}><Text style={styles.avatarTxt}>{name.charAt(0).toUpperCase()}</Text></View>
          )}
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{profile?.email || ''}</Text>
          {profile?.phone ? <Text style={styles.meta}>{profile.phone}</Text> : null}
          {profile?.state ? <Text style={styles.meta}>{profile.state}{profile.lga ? ' · ' + profile.lga : ''}</Text> : null}
          {profile?.primary_crops ? <Text style={styles.meta}>Grows: {profile.primary_crops}</Text> : null}
        </View>

        <View styleRow={styles.action}>
          {profile?.phone ? (
            <Pressable onPress={() => Linking.openURL('tel:' + profile.phone)} style={styles.actionBtn}>
              <Text style={styles.actionTxt}>Call</Text>
            </Pressable>
          ) : null}
          {profile?.phone ? (
            <Pressable onPress={() => Linking.openURL('https://wa.me/' + String(profile.phone).replace(/[^0-9]/g, ''))} style={styles.actionBtn}>
              <Text style={styles.actionTxt}>WhatsApp</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable onPress={() => router.push(('/starred-messages?uid=' + uid) as any)} style={styles.linkRow}>
          <Text style={styles.linkLabel}>Starred messages</Text>
          <View style={styles.linkRight}><Text style={styles.linkBadge}>{starCount}</Text><Text style={styles.chev}>›</Text></View>
        </Pressable>

        <Text style={styles.sectionTitle}>SHARED MEDIA ({media.length})</Text>
        {media.length === 0 ? (
          <Text style={styles.emptyText}>No photos shared yet.</Text>
        ) : (
          <View style={styles.grid}>
            {media.map((m) => (
              <Pressable key={String(m.id)} onPress={() => Linking.openURL(m.attachment_url)} style={styles.gridItem}>
                <Image source={{ uri: m.attachment_url }} style={styles.gridImg} />
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>SAFETY</Text>
        <Pressable onPress={toggleBlock} style={styles.safetyBtn}>
          <Text style={[styles.safetyTxt, { color: isBlocked ? palette.neon : palette.danger }]}>
            {isBlocked ? 'Unblock user' : 'Block user'}
          </Text>
        </Pressable>
        <Pressable onPress={reportUser} style={styles.safetyBtn}>
          <Text style={[styles.safetyTxt, { color: palette.warning }]}>Report user</Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#8696a0', marginBottom: 20 },
  hero: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 14 },
  avatarFallback: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#005c4b', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarTxt: { fontSize: 48, fontWeight: '900', color: '#00ff88' },
  name: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  email: { fontSize: 13, color: '#8696a0', marginTop: 4 },
  meta: { fontSize: 12, color: '#8696a0', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 20, justifyContent: 'center' },
  actionBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: '#202c33', borderWidth: 1, borderColor: '#2a3942' },
  actionTxt: { fontSize: 13, fontWeight: '800', color: '#00ff88' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#202c33', borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#2a3942' },
  linkLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  linkRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkBadge: { fontSize: 12, fontWeight: '900', color: '#00ff88', backgroundColor: 'rgba(0,255,136,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  chev: { fontSize: 20, color: '#8696a0' },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: '#8696a0', marginBottom: 10, marginTop: 8 },
  emptyText: { fontSize: 12, color: '#8696a0', fontStyle: 'italic', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 20 },
  gridItem: { width: '32%', aspectRatio: 1 },
  gridImg: { width: '100%', height: '100%', borderRadius: 6, backgroundColor: '#202c33' },
  safetyBtn: { padding: 16, backgroundColor: '#202c33', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#2a3942' },
  safetyTxt: { fontSize: 14, fontWeight: '800' },
});
