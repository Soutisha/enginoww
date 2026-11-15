'use client';

import { useEffect, useRef } from 'react';

export type NetworkNode = {
  id: string;
  entityId: string;
  kind: 'contact' | 'lead' | 'deal' | 'product' | 'agent' | string;
  label: string;
  detail?: string | null;
  score?: number | null;
  value?: number | null;
  currency?: string | null;
  stock?: number | null;
  totalSold?: number;
  updatedAt?: string | null;
  probability?: number;
};
export type NetworkLink = { source: string; target: string; kind: string };

type Props = {
  nodes: NetworkNode[];
  links: NetworkLink[];
  visibleKinds: string[];
  selectedId?: string | null;
  onSelect: (node: NetworkNode) => void;
};

type Projected = { node: NetworkNode; x: number; y: number; radius: number; depth: number };

const PALETTE: Record<string, string> = {
  contact: '#55d6be', lead: '#8b9cff', deal: '#c49aff', product: '#f4b86a', agent: '#f18fb4',
};
const RINGS: Record<string, number> = { contact: 0.34, lead: 0.57, deal: 0.78, product: 1.02, agent: 0.2 };

/** Dependency-free 3D projected renderer. It keeps the command centre usable without a WebGL package install. */
export function BusinessNetworkCanvas({ nodes, links, visibleKinds, selectedId, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const projectedRef = useRef<Projected[]>([]);
  const rotationRef = useRef(0);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const filteredNodes = nodes.filter((node) => visibleKinds.includes(node.kind));
  const nodeMap = new Map(filteredNodes.map((node) => [node.id, node]));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let disposed = false;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const points = filteredNodes.map((node, index) => {
      const sameKind = filteredNodes.filter((candidate) => candidate.kind === node.kind);
      const localIndex = sameKind.findIndex((candidate) => candidate.id === node.id);
      const count = Math.max(1, sameKind.length);
      const angle = (localIndex / count) * Math.PI * 2 + (node.kind === 'agent' ? 0.7 : 0);
      const radius = RINGS[node.kind] ?? 0.5;
      const z = Math.sin(angle * 2.3 + index * 0.27) * 0.34 + (node.kind === 'agent' ? 0.48 : 0);
      return { node, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.72, z };
    });

    const draw = () => {
      if (disposed) return;
      rotationRef.current += draggingRef.current ? 0 : 0.0018;
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2 + 8;
      const scale = Math.min(width * 0.39, height * 0.68);
      const angle = rotationRef.current;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const project = (x: number, y: number, z: number) => {
        const rx = x * cos - z * sin;
        const rz = x * sin + z * cos;
        const perspective = 1 / (1.7 - rz * 0.38);
        return { x: cx + rx * scale * perspective, y: cy + (y - rz * 0.14) * scale * perspective, depth: rz, perspective };
      };

      // Ambient star field and subtle orbital guides.
      for (let i = 0; i < 48; i += 1) {
        const sx = (i * 97.31 % Math.max(width, 1));
        const sy = (i * 53.17 % Math.max(height, 1));
        ctx.fillStyle = `rgba(164,190,255,${0.08 + (i % 4) * 0.025})`;
        ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = 'rgba(124,151,205,0.12)';
      ctx.lineWidth = 1;
      [0.34, 0.57, 0.78, 1.02].forEach((r) => {
        ctx.beginPath();
        ctx.ellipse(0, 0, scale * r, scale * r * 0.48, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();

      const projected: Projected[] = points.map(({ node, x, y, z }, index) => {
        const wobble = Math.sin(Date.now() / 1500 + index) * 0.012;
        const p = project(x, y + wobble, z);
        return { node, x: p.x, y: p.y, radius: (node.kind === 'agent' ? 7 : 5.5) * p.perspective, depth: p.depth };
      });
      projectedRef.current = projected;
      const byId = new Map(projected.map((item) => [item.node.id, item]));

      // Draw real CRM relationships behind the entity nodes.
      ctx.lineWidth = 1;
      links.forEach((link) => {
        const from = byId.get(link.source);
        const to = byId.get(link.target);
        if (!from || !to) return;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = 'rgba(132,157,210,0.23)';
        ctx.stroke();
      });

      // Central business core.
      const core = project(0, 0, 0.1);
      const glow = ctx.createRadialGradient(core.x, core.y, 2, core.x, core.y, 72);
      glow.addColorStop(0, 'rgba(95,130,255,0.2)');
      glow.addColorStop(1, 'rgba(95,130,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(core.x, core.y, 72, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(core.x, core.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#172b50'; ctx.fill();
      ctx.strokeStyle = 'rgba(134,165,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#dce7ff'; ctx.font = '600 7px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('BIZ', core.x, core.y + 2.5);

      projected.sort((a, b) => a.depth - b.depth).forEach((item) => {
        const color = PALETTE[item.node.kind] || '#9ca3af';
        const selected = item.node.id === selectedId;
        const fade = 0.55 + (item.depth + 1) * 0.2;
        ctx.beginPath(); ctx.arc(item.x, item.y, item.radius * (selected ? 3.4 : 2.6), 0, Math.PI * 2);
        ctx.fillStyle = `${color}18`; ctx.fill();
        ctx.beginPath(); ctx.arc(item.x, item.y, item.radius * (selected ? 1.4 : 1), 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.globalAlpha = fade; ctx.fill(); ctx.globalAlpha = 1;
        if (selected) {
          ctx.beginPath(); ctx.arc(item.x, item.y, item.radius * 2.1, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
        }
        if (item.depth > -0.2 || selected) {
          ctx.font = `${selected ? '600' : '500'} ${selected ? 10 : 8}px Inter, sans-serif`;
          ctx.textAlign = 'center'; ctx.fillStyle = selected ? '#f8fbff' : 'rgba(207,220,244,0.8)';
          const title = item.node.label.length > 18 ? `${item.node.label.slice(0, 17)}…` : item.node.label;
          ctx.fillText(title, item.x, item.y - item.radius - 7);
        }
      });
      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      disposed = true;
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [filteredNodes, links, selectedId]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = true;
    movedRef.current = false;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingRef.current) {
      const delta = event.clientX - lastPointerRef.current.x;
      if (Math.abs(delta) > 2) movedRef.current = true;
      rotationRef.current += delta * 0.008;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
    }
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false;
    if (movedRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = [...projectedRef.current].reverse().find((item) => Math.hypot(item.x - x, item.y - y) < Math.max(15, item.radius * 2.2));
    if (hit && nodeMap.has(hit.node.id)) onSelect(hit.node);
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Interactive three-dimensional business network. Drag to rotate and select a node to inspect its CRM record."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { draggingRef.current = false; }}
      className="h-full w-full touch-pan-y cursor-grab active:cursor-grabbing"
    />
  );
}
