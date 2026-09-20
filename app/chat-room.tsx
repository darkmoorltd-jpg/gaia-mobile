import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

interface Msg {
  id: number | string;
  sender_id: string;
  body: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
}

export default function ChatRoom() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('Chat');
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const markRead = useCallback(async (rid: string) => {
    if (!user) return;
    await supabase
      .from('chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', rid)
      .eq('user_id', user.id);

    // Mark all messages from the other user as read
    await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('room_id', rid)
      .neq('sender_id', user.id)
      .is('read_at', null);
  }, [user]);

  const load = useCallback(async () => {
    if (!user || !uid) return;
    setBusy(true);
    try {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('email,first_name,last_name,avatar_url')
        .eq('user_id', uid)
        .maybeSingle();

      if (prof) {
        const n = ((prof.first_name || '') + ' ' + (prof.last_name || '')).trim();
        setOtherName(n || (prof.email ? prof.email.split('@')[0] : 'Chat'));
        setOtherAvatar(prof.avatar_url || null);
      }

      const { data: rid, error: ridErr } = await supabase.rpc('get_or_create_dm', {
        other_user_id: uid,
      });
      if (ridErr || !rid) throw ridErr || new Error('no room');
      const roomIdValue = rid as unknown as string;
      setRoomId(roomIdValue);

      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('id,sender_id,body,created_at,attachment_url,attachment_type,delivered_at,read_at')
        .eq('room_id', roomIdValue)
        .order('created_at', { ascending: true })
        .limit(300);

      setMessages((msgs || []) as Msg[]);
      await markRead(roomIdValue);
    } catch (e) {
      console.log('room load error', e);
    } finally {
      setBusy(false);
    }
  }, [user, uid, markRead]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: listen for new messages + read receipts
  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase
      .channel('room-' + roomId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: 'room_id=eq.' + roomId,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Msg;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            if (newMsg.sender_id !== user.id) {
              markRead(roomId);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Msg;
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user, markRead]);

  const sendText = async () => {
    const body = text.trim();
    if (!body || !roomId || !user) return;
    setText('');
    setSending(true);
    try {
      await supabase.from('chat_messages').insert({
        room_id: roomId,
        sender_id: user.id,
        body,
      });
    } catch (e) {
      console.log('send error', e);
    } finally {
      setSending(false);
    }
  };

  const uploadAndSend = async (
    uri: string,
    name: string,
    mime: string,
    type: 'image' | 'file',
  ) => {
    if (!roomId || !user) return;
    setUploading(true);
    try {
      const response = await fetch(uri);
      const arrayBuffer = await new Response(response.body ?? response).arrayBuffer();
      const ext = (name.split('.').pop() || 'bin').toLowerCase();
      const path = roomId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

      const { error: upErr } = await supabase.storage
        .from('chat-attachments')
        .upload(path, arrayBuffer, { contentType: mime, upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(path);

      await supabase.from('chat_messages').insert({
        room_id: roomId,
        sender_id: user.id,
        body: name,                 // store the filename (or 'photo.jpg')
        attachment_url: pub.publicUrl,
        attachment_type: type,
      });
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    await uploadAndSend(
      asset.uri,
      asset.fileName || 'photo.jpg',
      asset.mimeType || 'image/jpeg',
      'image',
    );
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      await uploadAndSend(
        asset.uri,
        asset.name || 'document',
        asset.mimeType || 'application/octet-stream',
        'file',
      );
    } catch (e) {
      console.log('file pick error', e);
    }
  };

  const ticks = (m: Msg) => {
    if (m.sender_id !== user?.id) return '';
    if (m.read_at) return '✓✓';
    if (m.delivered_at) return '✓✓';
    return '✓';
  };

  const tickColor = (m: Msg) => {
    if (m.read_at) return '#4fc3f7';
    return 'rgba(0,0,0,0.45)';
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const mine = item.sender_id === user?.id;
    const isImage = !!item.attachment_url && item.attachment_type === 'image';
    const isFile  = !!item.attachment_url && item.attachment_type === 'file';
    const isText  = !isImage && !isFile;
    const caption = item.body && item.body.trim() ? item.body : null;

    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
        <View
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            isImage && { padding: 6, paddingBottom: 6 },
          ]}
        >
          {isImage ? (
            <Pressable onPress={() => Linking.openURL(item.attachment_url!)}>
              <Image
                source={{ uri: item.attachment_url! }}
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 14,
                  backgroundColor: 'rgba(0,0,0,0.15)',
                }}
                resizeMode="cover"
              />
            </Pressable>
          ) : null}

          {isFile ? (
            <Pressable
              onPress={() => Linking.openURL(item.attachment_url!)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                minWidth: 200,
                paddingVertical: 4,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: mine ? 'rgba(0,0,0,0.15)' : 'rgba(0,200,100,0.15)',
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '900',
                    color: mine ? '#000' : '#00cc66',
                  }}
                >
                  F
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: mine ? '#000' : (palette.text ?? '#fff'),
                  }}
                >
                  {caption || 'Attachment'}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    marginTop: 2,
                    color: mine ? 'rgba(0,0,0,0.6)' : (palette.textMuted ?? '#888'),
                  }}
                >
                  Tap to open
                </Text>
              </View>
            </Pressable>
          ) : null}

          {isText && caption ? (
            <Text
              style={[
                styles.bubbleText,
                mine ? styles.bubbleTextMine : styles.bubbleTextTheirs,
              ]}
            >
              {caption}
            </Text>
          ) : null}

          {isImage && caption ? (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                marginTop: 6,
                marginHorizontal: 4,
                color: mine ? 'rgba(0,0,0,0.6)' : (palette.textMuted ?? '#888'),
              }}
            >
              {caption}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <Text
              style={[
                styles.bubbleTime,
                mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs,
              ]}
            >
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {mine ? (
              <Text style={[styles.ticks, { color: tickColor(item) }]}>
                {ticks(item)}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.avatarWrap}>
          {otherAvatar ? (
            <Image source={{ uri: otherAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{otherName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{otherName}</Text>
          <Text style={styles.sub}>Tap for info</Text>
        </View>
      </View>

      {busy ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.neon} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>M</Text>
          <Text style={styles.emptyTitle}>Say hi to {otherName}</Text>
          <Text style={styles.emptySub}>
            Messages are private between you two.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={styles.inputBar}>
        <Pressable onPress={pickImage} style={styles.attachBtn}>
          <Text style={styles.attachIcon}>I</Text>
        </Pressable>
        <Pressable onPress={pickFile} style={styles.attachBtn}>
          <Text style={styles.attachIcon}>F</Text>
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={palette.textDim}
          style={styles.input}
          multiline
        />
        <Pressable
          onPress={sendText}
          disabled={!text.trim() || sending || uploading}
          style={[
            styles.sendBtn,
            (!text.trim() || sending || uploading) && { opacity: 0.4 },
          ]}
        >
          {sending || uploading ? (
            <ActivityIndicator color={palette.obsidian} size="small" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.obsidian },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: 60,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
    },
    backText: { fontSize: 26, color: palette.neon, lineHeight: 28, fontWeight: '300' },
    avatarWrap: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: palette.neonSoft,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 16, fontWeight: '900', color: palette.neon },
    name: { fontSize: 16, fontWeight: '800', color: palette.text, letterSpacing: -0.3 },
    sub: { ...typography.micro, color: palette.textMuted, marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
    emptyIcon: { fontSize: 56, color: palette.neonSoft, fontWeight: '900', marginBottom: spacing.md },
    emptyTitle: { ...typography.heading, color: palette.text, textAlign: 'center' },
    emptySub: {
      ...typography.body, color: palette.textMuted,
      textAlign: 'center', marginTop: 6,
    },
    list: { padding: spacing.lg },
    msgRow: { marginVertical: 4, flexDirection: 'row' },
    msgRowMine: { justifyContent: 'flex-end' },
    msgRowTheirs: { justifyContent: 'flex-start' },
    bubble: { maxWidth: '78%', paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 18 },
    bubbleMine: { backgroundColor: palette.neon, borderBottomRightRadius: 6 },
    bubbleTheirs: {
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      borderBottomLeftRadius: 6,
    },
    bubbleText: { fontSize: 15, lineHeight: 21 },
    bubbleTextMine: { color: palette.obsidian, fontWeight: '600' },
    bubbleTextTheirs: { color: palette.text },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      marginTop: 2,
    },
    bubbleTime: { fontSize: 10 },
    bubbleTimeMine: { color: 'rgba(0,0,0,0.55)' },
    bubbleTimeTheirs: { color: palette.textDim },
    ticks: { fontSize: 11, fontWeight: '900' },
    attachImage: { width: 220, height: 220, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.15)' },
    fileRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: 4,
    },
    fileIcon: {
      fontSize: 18, fontWeight: '900',
      color: palette.obsidian,
    },
    fileName: { fontSize: 13, maxWidth: 180 },
    fileNameMine: { color: palette.obsidian, fontWeight: '700' },
    fileNameTheirs: { color: palette.text },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    attachBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      alignItems: 'center', justifyContent: 'center',
    },
    attachIcon: { fontSize: 14, fontWeight: '900', color: palette.neon },
    input: {
      flex: 1, minHeight: 40, maxHeight: 120,
      paddingHorizontal: spacing.lg, paddingVertical: 10,
      borderRadius: 22,
      backgroundColor: palette.surface,
      borderWidth: 1, borderColor: palette.border,
      color: palette.text, fontSize: 15,
    },
    sendBtn: {
      paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: 22, backgroundColor: palette.neon,
      minWidth: 64, alignItems: 'center',
    },
    sendText: { fontSize: 13, fontWeight: '800', color: palette.obsidian },
  });
