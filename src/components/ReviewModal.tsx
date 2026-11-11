
import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { supabase } from '../api/supabase';
import { useTheme } from '../theme';
export default function ReviewModal({ visible, orderId, productName, onClose, onSubmitted }: any) {
  const { palette } = useTheme();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const submit = async () => {
    await supabase.from('input_reviews').insert({ order_id: orderId, rating, comment });
    onSubmitted();
  };
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: palette.surface, padding: 20, borderRadius: 16 }}>
          <Text style={{ color: palette.text, fontSize: 18, fontWeight: '900', marginBottom: 12 }}>Rate {productName}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[1,2,3,4,5].map(i => <Pressable key={i} onPress={() => setRating(i)}><Text style={{ fontSize: 24, color: i <= rating ? '#ffd700' : '#555' }}>★</Text></Pressable>)}
          </View>
          <TextInput placeholder="Leave a comment..." placeholderTextColor="#888" style={{ backgroundColor: '#000', padding: 12, borderRadius: 8, color: '#fff' }} onChangeText={setComment} />
          <Pressable onPress={submit} style={{ backgroundColor: '#b388ff', padding: 14, borderRadius: 8, marginTop: 16, alignItems: 'center' }}><Text style={{ color: '#000', fontWeight: '900' }}>SUBMIT</Text></Pressable>
          <Pressable onPress={onClose} style={{ marginTop: 12, alignItems: 'center' }}><Text style={{ color: '#888' }}>Close</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
