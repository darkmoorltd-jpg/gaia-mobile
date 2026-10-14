import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface Props {
  values: number[];      // 0-100 confidence values
  width?: number;
  height?: number;
  color?: string;
  label?: string;
}

export default function Sparkline({
  values,
  width = 220,
  height = 44,
  color = '#00ff88',
  label,
}: Props) {
  if (!values || values.length === 0) {
    return (
      <View style={[styles.wrap, { width, height }]}>
        <Text style={styles.empty}>No data</Text>
      </View>
    );
  }

  const min = 0;
  const max = 100;
  const n = values.length;
  const padX = 4;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const pts = values.map((v, i) => {
    const x = padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = padY + innerH - ((v - min) / (max - min)) * innerH;
    return { x, y, v };
  });

  const pathD = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  return (
    <View style={{ width }}>
      {label ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
      <Svg width={width} height={height}>
        <Path d={pathD} stroke={color} strokeWidth={2} fill="none" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={2} fill={color} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 10, color: '#8899a6' },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
});
