'use client';

import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Route transition. Motion is used as the installed GSAP-equivalent animation layer. */
export function PageTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        initial={reduce ? false : { opacity: 0, y: 8, filter: 'blur(3px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={reduce ? undefined : { opacity: 0, y: -4, filter: 'blur(2px)' }}
        transition={{ duration: reduce ? 0 : 0.24, ease: EASE }}
        className="min-h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.035 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.38, ease: EASE } },
};

/** Staggered load-in for a grid of widgets. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={container} initial={reduce ? 'show' : 'hidden'} animate="show">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div variants={item} className={className}>{children}</motion.div>;
}

/** Small interaction wrapper for buttons, tiles and other touch targets. */
export function MotionPressable({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reduce ? undefined : { y: -2 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
    >
      {children}
    </motion.div>
  );
}
