import type { LogEntry } from '../store/gameStore';

function iconFor(entry: LogEntry): string {
  const p = entry.play;
  if (!p) return '📺';
  if (p.isReview) return '📺';
  if (p.isStrategy) return '📋';
  if (p.isChaos) return '⚡';
  return '🎲';
}

export default function PlayLog({ log }: { log: LogEntry[] }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 text-sm font-mono space-y-1 bg-neutral-50 min-h-40 max-h-72">
      {log.length === 0 && <div className="text-neutral-400">아직 플레이가 없습니다. "다음 진행"을 눌러 시작하세요.</div>}
      {log.map((entry) => {
        if (entry.note) {
          return (
            <div key={entry.id} className="font-semibold text-amber-700">
              {entry.note}
            </div>
          );
        }
        const p = entry.play!;
        const dice = p.d1 !== undefined ? `${p.d1}+${p.d2}=${p.sum} → ` : '';
        const runs = p.runs > 0 ? `  [+${p.runs}점]` : '';
        const count = p.pitchCount ? `  (${p.pitchCount.balls}B ${p.pitchCount.strikes}S)` : '';
        return (
          <div key={entry.id} className="text-neutral-800">
            {iconFor(entry)} {dice}{p.label}{p.batterName ? ` (${p.batterName})` : ''}{runs}
            {count && <span className="text-neutral-400">{count}</span>}
          </div>
        );
      })}
    </div>
  );
}
