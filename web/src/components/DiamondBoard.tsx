import { nameOf } from '../engine/engine';
import type { Bases } from '../engine/types';

function BaseDot({ x, y, occupied }: { x: number; y: number; occupied: boolean }) {
  return (
    <rect
      x={x} y={y} width={8} height={8}
      fill={occupied ? '#2C6B47' : '#FFFFFF'}
      stroke="#1C231D" strokeWidth={1.5}
      style={{ transition: 'fill 200ms ease' }}
    />
  );
}

export default function DiamondBoard({ bases }: { bases: Bases }) {
  const [first, second, third] = bases;

  return (
    <div className="flex flex-col items-center gap-2 py-3">
      <svg viewBox="0 0 200 200" className="w-32 h-32 sm:w-40 sm:h-40">
        <path d="M100,178 L172,106 L100,34 L28,106 Z" fill="#DCE8DD" stroke="#2C6B47" strokeWidth={2.5} />
        <circle cx="100" cy="118" r="6" fill="#A3542A" />
        <BaseDot x={168} y={102} occupied={Boolean(first)} />
        <BaseDot x={96} y={30} occupied={Boolean(second)} />
        <BaseDot x={24} y={102} occupied={Boolean(third)} />
        <rect x={95} y={173} width={10} height={10} fill="#A3542A" stroke="#1C231D" strokeWidth={1.5} />
      </svg>
      <div className="text-xs sm:text-sm text-neutral-600 flex gap-4">
        <span>1루: {first ? nameOf(first) : '-'}</span>
        <span>2루: {second ? nameOf(second) : '-'}</span>
        <span>3루: {third ? nameOf(third) : '-'}</span>
      </div>
    </div>
  );
}
