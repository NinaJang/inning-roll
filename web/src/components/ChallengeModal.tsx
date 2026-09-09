import type { PendingChallenge } from '../store/gameStore';

export default function ChallengeModal({
  pending, teamName, remaining, onDecide,
}: {
  pending: PendingChallenge;
  teamName: string;
  remaining: number;
  onDecide: (accepted: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 flex flex-col gap-3">
        <h3 className="font-bold text-lg">📺 비디오 판독</h3>
        <p className="text-sm text-neutral-700">
          <span className="font-semibold">{teamName}</span> - 이 판정에 도전하시겠습니까? (잔여 {remaining}회)
        </p>
        <p className="text-sm text-neutral-600 bg-neutral-100 rounded px-3 py-2">{pending.play.label}</p>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => onDecide(false)} className="px-4 py-1.5 rounded border border-neutral-300 text-sm">
            그냥 진행
          </button>
          <button onClick={() => onDecide(true)} className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm font-semibold">
            도전한다
          </button>
        </div>
      </div>
    </div>
  );
}
