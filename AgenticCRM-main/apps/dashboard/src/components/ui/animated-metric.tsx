'use client';

import { useEffect, useMemo } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';

/** Animates the numeric portion while preserving currency/compact suffixes. */
export function AnimatedMetric({ value }: { value: string | number }) {
  const text = String(value);
  const match = useMemo(() => text.match(/^([^0-9+\-]*)([+\-]?[0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/), [text]);
  const target = match ? Number(match[2].replace(/,/g, '')) : Number.NaN;
  const decimals = match?.[2].split('.')[1]?.length ?? 0;
  const prefix = match?.[1] ?? '';
  const suffix = match?.[3] ?? '';
  const raw = useMotionValue(0);
  const spring = useSpring(raw, { stiffness: 95, damping: 24, mass: 0.7 });
  const display = useTransform(spring, (n) => `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (reduce) { raw.set(target); return; }
    const frame = requestAnimationFrame(() => raw.set(target));
    return () => cancelAnimationFrame(frame);
  }, [raw, target, reduce]);

  if (!match || !Number.isFinite(target)) return <>{text}</>;
  return <motion.span>{display}</motion.span>;
}
