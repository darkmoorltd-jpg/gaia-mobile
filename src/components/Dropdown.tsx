import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { useTheme } from '../theme';

interface Option {
  label: string;
  value: string;
}

interface Props {
  label: string;
  value: string;
  options: Option[] | string[];
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}

export default function Dropdown({
  label, value, options, onChange, placeholder, required,
}: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [open, setOpen] = useState(false);

  // normalize
  const opts: Option[] = options.map((o: any) =>
    typeof o === 'string' ? { label: o, value: o } : o
  );

  const current = opts.find((o) => o.value === value);
  const display = current ? current.label : (placeholder || 'Select…');

  return (
    <View>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.trigger}>
        <Text style={[styles.triggerText, !current && styles.placeholder]} numberOfLines={1}>
          {display}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
              <Text style={styles.closeText}>CLOSE</Text>
            </Pressable>
            <Text style={styles.modalTitle}>{label}</Text>
            <Text style={styles.modalSub}>Tap to select</Text>
            <ScrollView>
              {opts.map((o) => {
                const on = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => { onChange(o.value); setOpen(false); }}
                    style={[styles.row, on && styles.rowOn]}
                  >
                    <Text style={[styles.rowText, on && styles.rowTextOn]}>{o.label}</Text>
                    {on ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  label: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
    color: p.textMuted, marginTop: 14, marginBottom: 6,
  },
  trigger: {
    paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 56,
  },
  triggerText: { fontSize: 15, fontWeight: '600', color: p.text, flex: 1 },
  placeholder: { color: p.textDim, fontWeight: '400' },
  chevron: { fontSize: 16, color: p.neon, marginLeft: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '86%',
  },
  closeBtn: { paddingVertical: 6 },
  closeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  modalTitle: { fontSize: 22, fontWeight: '900', color: p.text, marginTop: 8 },
  modalSub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 12 },
  row: {
    paddingVertical: 18, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 56,
  },
  rowOn: { backgroundColor: 'rgba(0,255,136,0.10)' },
  rowText: { fontSize: 15, color: p.text },
  rowTextOn: { color: p.neon, fontWeight: '800' },
  check: { fontSize: 18, color: p.neon, fontWeight: '900' },
});
