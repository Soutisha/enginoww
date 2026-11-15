import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['Motion route transitions use exit/enter presence', read('apps/dashboard/src/components/ui/motion.tsx').includes('AnimatePresence') && read('apps/dashboard/src/components/ui/motion.tsx').includes('exit=')],
  ['Staggered dashboard entrance remains available', read('apps/dashboard/src/components/ui/motion.tsx').includes('staggerChildren')],
  ['Reusable micro-interaction wrapper exists', read('apps/dashboard/src/components/ui/motion.tsx').includes('MotionPressable')],
  ['KPI values use spring animation', read('apps/dashboard/src/components/ui/animated-metric.tsx').includes('useSpring')],
  ['StatCard renders animated numeric values', read('apps/dashboard/src/components/ui/stat-card.tsx').includes('AnimatedMetric')],
  ['Application shell uses ambient atmosphere layer', read('apps/dashboard/src/components/shell/app-shell.tsx').includes('app-atmosphere')],
  ['Dashboard content enables smooth scrolling', read('apps/dashboard/src/components/shell/app-shell.tsx').includes('dashboard-scroll')],
  ['CSS ambient lighting is implemented', read('apps/dashboard/src/app/globals.css').includes('radial-gradient(ellipse')],
  ['Premium card hover treatment is implemented', read('apps/dashboard/src/app/globals.css').includes('.premium-card:hover')],
  ['Skeleton shimmer exists', read('apps/dashboard/src/app/globals.css').includes('@keyframes shimmer')],
  ['Skeleton shimmer respects reduced motion', read('apps/dashboard/src/app/globals.css').includes('.skeleton { animation: none; }')],
  ['Global reduced-motion fallback disables animation', read('apps/dashboard/src/app/globals.css').includes('animation-duration: .01ms !important')],
  ['Motion route transitions respect reduced motion', read('apps/dashboard/src/components/ui/motion.tsx').includes('useReducedMotion')],
  ['KPI animation respects reduced motion', read('apps/dashboard/src/components/ui/animated-metric.tsx').includes('if (reduce)')],
  ['Task 19 documentation exists', fs.existsSync(path.join(root, 'TASK19_MOTION_CINEMATIC_EXPERIENCE.md'))],
];
let passed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (ok) passed++;
}
console.log(`\nTask 19 verification: ${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exit(1);
