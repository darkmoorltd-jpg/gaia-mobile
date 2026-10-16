import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle } from 'react-native';

interface Props {
  value: number;
  duration?: number;   // ms
  prefix?: string;
  suffix?: string;
  decimals?: number;
  separator?: boolean;
  style?: TextStyle | TextStyle[];
  formatCurrency?: boolean;
}

export default function CountUp({
  value,
  duration = 900,
  prefix = '',
  suffix = '',
  decimals = 0,
  separator = true,
  style,
  formatCurrency = false,
}: Props) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const rafRef = useRef<any>(null);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    const target = Number.isFinite(value) ? value : 0;

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const p = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      const current = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(current);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const fmt = (n: number) => {
    const fixed = n.toFixed(decimals);
    if (!separator) return fixed;
    const [int, dec] = fixed.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return dec ? `${grouped}.${dec}` : grouped;
  };

  return (
    <Text style={style}>
      {prefix}
      {formatCurrency ? '₦' : ''}
      {fmt(display)}
      {suffix}
    </Text>
  );
}
