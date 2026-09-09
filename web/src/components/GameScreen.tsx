import { battingTeam, fieldingTeam } from '../engine/engine';
import { useGameStore } from '../store/gameStore';
import AtBatPanel from './AtBatPanel';
import ChallengeModal from './ChallengeModal';
import DiamondBoard from './DiamondBoard';
import GameOverBanner from './GameOverBanner';
import PlayLog from './PlayLog';
import Scoreboard from './Scoreboard';
import StrategyModal from './StrategyModal';

export default function GameScreen() {
  const game = useGameStore((s) => s.game);
  const log = useGameStore((s) => s.log);
  const fastForward = useGameStore((s) => s.fastForward);
  const pendingChallenge = useGameStore((s) => s.pendingChallenge);
  const pendingStrategyAnnounce = useGameStore((s) => s.pendingStrategyAnnounce);
  const turnInProgress = useGameStore((s) => s.turnGen !== null);
  const screen = useGameStore((s) => s.screen);
  const advance = useGameStore((s) => s.advance);
  const callStrategy = useGameStore((s) => s.callStrategy);
  const resolveChallenge = useGameStore((s) => s.resolveChallenge);
  const dismissStrategyAnnounce = useGameStore((s) => s.dismissStrategyAnnounce);
  const toggleFastForward = useGameStore((s) => s.toggleFastForward);
  const restart = useGameStore((s) => s.restart);

  if (!game) return null;

  const offenseTeam = battingTeam(game);
  const defenseTeam = fieldingTeam(game);
  const modalBusy = Boolean(pendingChallenge || pendingStrategyAnnounce);
  const canAdvance = !game.gameOver && !modalBusy && !fastForward;

  return (
    <div className="max-w-xl mx-auto p-4">
      <div className="rounded-lg border border-neutral-200 overflow-hidden shadow-sm bg-white">
        <Scoreboard game={game} fastForward={fastForward} onToggleFastForward={toggleFastForward} />
        <DiamondBoard bases={game.bases} />
        <AtBatPanel game={game} />

        <div className="flex flex-wrap gap-2 px-4 py-3">
          <button
            onClick={advance}
            disabled={!canAdvance}
            className="px-4 py-2 rounded bg-neutral-900 text-white text-sm font-semibold disabled:bg-neutral-300 disabled:cursor-not-allowed"
          >
            {fastForward ? '자동 진행 중...' : '다음 진행'}
          </button>
          <button
            onClick={() => callStrategy('offense')}
            disabled={modalBusy || turnInProgress || game.gameOver || game.strategyUses[offenseTeam] <= 0}
            className="px-4 py-2 rounded border border-emerald-600 text-emerald-700 text-sm font-semibold disabled:border-neutral-300 disabled:text-neutral-400 disabled:cursor-not-allowed"
          >
            공격 전략 ({game.strategyUses[offenseTeam]})
          </button>
          <button
            onClick={() => callStrategy('defense')}
            disabled={modalBusy || turnInProgress || game.gameOver || game.strategyUses[defenseTeam] <= 0}
            className="px-4 py-2 rounded border border-amber-600 text-amber-700 text-sm font-semibold disabled:border-neutral-300 disabled:text-neutral-400 disabled:cursor-not-allowed"
          >
            수비 전략 ({game.strategyUses[defenseTeam]})
          </button>
        </div>

        <PlayLog log={log} />
      </div>

      {pendingChallenge && (
        <ChallengeModal
          pending={pendingChallenge}
          teamName={game.teamNames[pendingChallenge.side]}
          remaining={game.challenges[pendingChallenge.side]}
          onDecide={resolveChallenge}
        />
      )}
      {pendingStrategyAnnounce && (
        <StrategyModal pending={pendingStrategyAnnounce} onConfirm={dismissStrategyAnnounce} />
      )}
      {screen === 'over' && <GameOverBanner game={game} onRestart={restart} />}
    </div>
  );
}
