import type { GameState } from '../engine/types';

export default function GameOverBanner({ game, onRestart }: { game: GameState; onRestart: () => void }) {
  const { away, home } = game.score;
  const resultText = away === home
    ? '무승부'
    : away > home
      ? `${game.teamNames.away} 승리`
      : `${game.teamNames.home} 승리`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 flex flex-col items-center gap-3 text-center">
        <h3 className="font-bold text-xl">경기 종료</h3>
        <p className="text-2xl font-bold tabular-nums">
          {game.teamNames.away} {away} : {home} {game.teamNames.home}
        </p>
        <p className="text-neutral-600">{resultText}</p>
        <button onClick={onRestart} className="mt-2 px-5 py-2 rounded bg-emerald-600 text-white font-semibold">
          다시하기
        </button>
      </div>
    </div>
  );
}
