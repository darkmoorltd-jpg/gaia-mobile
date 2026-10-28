import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../theme';
import { supabase } from '../api/supabase';

interface Props {
  visible: boolean;
  orderId: string | null;
  productName?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function ReviewModal({ visible, orderId, productName, onClose, onSubmitted }: Props) {
  const { palette } = useTheme();
  const s = createStyles(palette);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!orderId) return;
    if (rating < 1) { Alert.alert('Pick a rating'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('input_submit_review', {
      p_order_id: orderId, p_rating: rating, p_comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    Alert.alert('Thank you!', 'Your review helps other farmers.');
    setRating(0); setComment('');
    onSubmitted?.();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={s.modalBg}>
          <View style={s.sheet}>
            <Text style={s.title}>Rate your purchase</Text>
            {productName ? <Text style={s.sub}>{productName}</Text> : null}

            <View style={s.stars}>
              {[1,2,3,4,5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={8}>
                  <Text style={[s.star, rating >= n && s.starOn]}>{rating >= n ? '★' : '☆'}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.ratingLabel}>
              {rating === 0 ? 'Tap to rate' : rating === 1 ? 'Poor' : rating === 2 ? 'Fair' : rating === 3 ? 'Good' : rating === 4 ? 'Great' : 'Excellent'}
            </Text>

            <Text style={s.label}>COMMENT (optional)</Text>
            <TextInput
              value={comment} onChangeText={setComment}
              placeholder="Quality, delivery, packaging..."
              placeholderTextColor={palette.textDim}
              multiline style={[s.input, { minHeight: 80 }]}
            />

            <Pressable onPress={submit} disabled={busy || rating < 1} style={[s.cta, (busy || rating < 1) && { opacity: 0.4 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={s.ctaText}>SUBMIT REVIEW</Text>}
            </Pressable>

            <Pressable onPress={onClose} style={[s.cta, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border }]}>
              <Text style={[s.ctaText, { color: palette.text }]}>MAYBE LATER</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: p.abyss, borderRadius: 20, padding: 24 },
  title: { fontSize: 22, fontWeight: '900', color: p.text, textAlign: 'center' },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, textAlign: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 8 },
  star: { fontSize: 40, color: '#4b5563' },
  starOn: { color: '#ffd700' },
  ratingLabel: { fontSize: 12, color: p.textMuted, textAlign: 'center', marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: '#b388ff', alignItems: 'center', marginTop: 12 },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
