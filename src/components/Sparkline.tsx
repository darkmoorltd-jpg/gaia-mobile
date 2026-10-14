import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  label?: string;
}

export default function Sparkline({
  values,
  width = 280,
  height = 50,
  color = '#00ff88',
  label,
}: Props) {
  if (!values || values.length === 0) {
    return <View style={{ width, height }} />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const barW = Math.max(2, Math.floor(width / values.length) - 2);

  return (
    <View style={{ width }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.row, { width, height }]}>
        {values.map((v, i) => {
          const h = Math.max(3, ((v - min) / range) * height);
          return (
            <View
              key={i}
              style={{
                width: barW,
                height: h,
                backgroundColor: color,
                marginRight: 2,
                borderRadius: 2,
                alignSelf: 'flex-end',
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 9, fontWeight: '800', color: '#8899a6', letterSpacing: 1, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
