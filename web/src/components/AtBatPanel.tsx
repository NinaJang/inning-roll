import { getCurrentBatter, nameOf } from '../engine/engine';
import { SPECIALTIES } from '../engine/teams';
import type { GameState } from '../engine/types';

export default function AtBatPanel({ game }: { game: GameState }) {
  const batter = getCurrentBatter(game);
  const battingSide = game.half === 'top' ? 'away' : 'home';
  const specLabel = batter.specialty ? SPECIALTIES[batter.specialty].label : null;

  return (
    <div className="px-4 py-2 border-y border-neutral-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
      <div>
        타석 - <span className="font-semibold">{nameOf(batter)}</span>
        {specLabel && <span className="ml-1 text-emerald-700">[{specLabel}]</span>}
        <span className="text-neutral-500"> ({game.teamNames[battingSide]})</span>
      </div>
      <div className="text-xs text-neutral-500">
        챌린지 {game.teamNames.away} {game.challenges.away} / {game.teamNames.home} {game.challenges.home}
        {'  ·  '}
        전략 {game.teamNames.away} {game.strategyUses.away} / {game.teamNames.home} {game.strategyUses.home}
      </div>
    </div>
  );
}
