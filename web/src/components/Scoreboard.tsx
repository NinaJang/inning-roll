import type { GameState } from '../engine/types';

function OutDot({ filled }: { filled: boolean }) {
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full border ${filled ? 'bg-red-500 border-red-500' : 'bg-transparent border-neutral-400'}`}
      style={{ transition: 'background-color 200ms ease' }}
    />
  );
}

export default function Scoreboard({
  game, fastForward, onToggleFastForward,
}: {
  game: GameState;
  fastForward: boolean;
  onToggleFastForward: () => void;
}) {
  const halfLabel = `${game.inning}회 ${game.half === 'top' ? '초' : '말'}`;
  const outs = Math.min(game.outs, 3);

  return (
    <div className="bg-neutral-900 text-white rounded-t-lg">
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="font-mono text-xs sm:text-sm shrink-0">{halfLabel}</div>
        <div className="font-bold text-base sm:text-lg tabular-nums text-center">
          {game.teamNames.away} {game.score.away} : {game.score.home} {game.teamNames.home}
        </div>
        <label className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer select-none shrink-0">
          <span>⚡ 빨리감기</span>
          <input
            type="checkbox"
            checked={fastForward}
            onChange={onToggleFastForward}
            className="w-4 h-4 accent-emerald-500"
          />
        </label>
      </div>
      <div className="flex items-center gap-2 px-4 pb-2 text-xs sm:text-sm">
        <span className="text-neutral-300">아웃</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => <OutDot key={i} filled={i < outs} />)}
        </div>
        <span className="tabular-nums text-neutral-400">({outs}/3)</span>
      </div>
    </div>
  );
}
