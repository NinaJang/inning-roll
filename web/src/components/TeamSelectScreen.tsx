import { useState } from 'react';
import { SPECIALTIES, TEAM_LIST } from '../engine/teams';
import { useGameStore } from '../store/gameStore';
import type { Team } from '../engine/types';

const INNING_OPTIONS = [3, 5, 7, 9];

function TeamCard({ team, selected, onSelect }: { team: Team; selected: boolean; onSelect: () => void }) {
  const specs = team.lineup
    .filter((p) => p.specialty)
    .map((p) => `${p.name}(${SPECIALTIES[p.specialty!].label})`)
    .join(', ');
  const pitcherSpec = team.pitcher.specialty
    ? `${team.pitcher.name}(${SPECIALTIES[team.pitcher.specialty].label})`
    : `${team.pitcher.name}(특기 없음)`;

  return (
    <button
      onClick={onSelect}
      className={`text-left rounded-lg border p-3 transition ${
        selected ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500' : 'border-neutral-300 hover:border-neutral-400'
      }`}
    >
      <div className="font-semibold text-neutral-900">{team.name}</div>
      <div className="text-xs text-neutral-500 mb-2">{team.tagline}</div>
      <div className="text-xs text-neutral-600">타자 특기: {specs || '없음'}</div>
      <div className="text-xs text-neutral-600">선발투수: {pitcherSpec}</div>
    </button>
  );
}

export default function TeamSelectScreen() {
  const [awayId, setAwayId] = useState<string | null>(null);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [innings, setInnings] = useState(9);
  const startGame = useGameStore((s) => s.startGame);

  const away = TEAM_LIST.find((t) => t.id === awayId) ?? null;
  const home = TEAM_LIST.find((t) => t.id === homeId) ?? null;

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">⚾ 이닝롤</h1>
        <p className="text-sm text-neutral-500">원정팀과 홈팀을 골라 경기를 시작하세요.</p>
      </div>

      <section>
        <h2 className="font-semibold mb-2 text-neutral-800">원정팀 선택</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEAM_LIST.map((t) => (
            <TeamCard key={t.id} team={t} selected={awayId === t.id} onSelect={() => setAwayId(t.id)} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2 text-neutral-800">홈팀 선택</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEAM_LIST.map((t) => (
            <TeamCard key={t.id} team={t} selected={homeId === t.id} onSelect={() => setHomeId(t.id)} />
          ))}
        </div>
      </section>

      <section className="flex items-center gap-2">
        <span className="font-semibold text-neutral-800 mr-1">이닝 수</span>
        {INNING_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setInnings(n)}
            className={`px-3 py-1 rounded border text-sm ${
              innings === n ? 'bg-emerald-600 text-white border-emerald-600' : 'border-neutral-300 text-neutral-700'
            }`}
          >
            {n}
          </button>
        ))}
      </section>

      <button
        disabled={!away || !home}
        onClick={() => away && home && startGame(away, home, innings)}
        className="self-start px-5 py-2 rounded bg-emerald-600 text-white font-semibold disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed"
      >
        경기 시작
      </button>
    </div>
  );
}
