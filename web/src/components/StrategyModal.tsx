import type { PendingStrategyAnnounce } from '../store/gameStore';

export default function StrategyModal({
  pending, onConfirm,
}: {
  pending: PendingStrategyAnnounce;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 flex flex-col gap-3">
        <h3 className="font-bold text-lg">📋 감독 지시 ({pending.side === 'offense' ? '공격' : '수비'})</h3>
        <p className="text-sm font-semibold text-neutral-800">"{pending.chosenLabel}"</p>
        <p className="text-sm text-neutral-600 bg-neutral-100 rounded px-3 py-2">
          {pending.boostOnly ? '다음 타석에 효과가 적용됩니다.' : pending.resultLabel}
        </p>
        <div className="flex justify-end mt-2">
          <button onClick={onConfirm} className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm font-semibold">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
