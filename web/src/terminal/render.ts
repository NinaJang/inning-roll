// cli.js의 콘솔 출력 포맷을 그대로 이식한 순수 렌더 함수들.
// console.log 대신 문자열 배열을 리턴해서 터미널 스크롤백에 이어붙인다.
import { battingTeam, getCurrentBatter, nameOf } from '../engine/engine';
import { SPECIALTIES, TEAM_LIST } from '../engine/teams';
import type { Bases, GameState, PlayEvent } from '../engine/types';

export function renderTeamList(): string[] {
  const lines: string[] = [''];
  TEAM_LIST.forEach((t, i) => {
    const specs = t.lineup
      .filter((p) => p.specialty)
      .map((p) => `${p.name}(${SPECIALTIES[p.specialty!].label})`)
      .join(', ');
    const pitcherSpec = t.pitcher.specialty
      ? `${t.pitcher.name}(${SPECIALTIES[t.pitcher.specialty].label})`
      : `${t.pitcher.name}(특기 없음)`;
    lines.push(`  ${i + 1}. ${t.name} — ${t.tagline}`);
    lines.push(`     타자 특기: ${specs || '없음'}`);
    lines.push(`     선발투수: ${pitcherSpec}`);
  });
  return lines;
}

function basesAscii(bases: Bases): string[] {
  const mark = (r: unknown) => (r ? '●' : '○');
  return [
    `        ${mark(bases[1])}`,
    `     ${mark(bases[2])}   ${mark(bases[0])}`,
    '        ⌂',
  ];
}

function runnerSummary(bases: Bases): string {
  const labels = ['1루', '2루', '3루'];
  const names = bases.map((r, i) => (r ? `${labels[i]}:${nameOf(r)}` : null)).filter(Boolean);
  return names.length ? `주자 - ${names.join(', ')}` : '주자 없음';
}

export function renderBoard(game: GameState): string[] {
  const batter = getCurrentBatter(game);
  const spec = batter.specialty ? ` [${SPECIALTIES[batter.specialty].label}]` : '';
  const battingSide = battingTeam(game);
  const halfLabel = `${game.inning}회 ${game.half === 'top' ? '초' : '말'}`;
  return [
    '',
    `${halfLabel}  |  아웃 ${Math.min(game.outs, 3)}  |  ${game.teamNames.away} ${game.score.away} : ${game.score.home} ${game.teamNames.home}`,
    ...basesAscii(game.bases),
    runnerSummary(game.bases),
    `타석 - ${nameOf(batter)}${spec} (${game.teamNames[battingSide]})`,
    `챌린지 - ${game.teamNames.away} ${game.challenges.away} / ${game.teamNames.home} ${game.challenges.home}   전략 - ${game.teamNames.away} ${game.strategyUses.away} / ${game.teamNames.home} ${game.strategyUses.home}`,
  ];
}

export function renderPlay(play: PlayEvent, game: GameState): string[] {
  const runsTag = play.runs > 0 ? `  [+${play.runs}점]` : '';
  const count = play.pitchCount ? `  (${play.pitchCount.balls}B ${play.pitchCount.strikes}S)` : '';
  const team = game.teamNames[play.team];

  if (play.isChaos) {
    return [`⚡ [${team}] ${play.label}${runsTag}`];
  }
  if (play.d1 !== undefined) {
    return [`🎲 ${play.d1}+${play.d2}=${play.sum} → ${play.label} (${play.batterName}, ${team})${runsTag}${count}`];
  }
  return [`📋 ${play.label} (${play.batterName ?? ''}, ${team})${runsTag}`];
}

export function renderHalfTransition(play: PlayEvent, game: GameState): string[] {
  const endHalf = play.half === 'top' ? '초' : '말';
  const newHalf = game.half === 'top' ? '초' : '말';
  return [`🔄 ${play.inning}회 ${endHalf} 종료 → ${game.inning}회 ${newHalf} 시작`];
}

export function renderFinish(game: GameState): string[] {
  const { away, home } = game.score;
  const result = away === home ? '무승부' : away > home ? `${game.teamNames.away} 승리` : `${game.teamNames.home} 승리`;
  return [
    '',
    '=== 경기 종료 ===',
    `최종 스코어  ${game.teamNames.away} ${away} : ${home} ${game.teamNames.home}`,
    result,
    '',
    '"다시하기"를 눌러 팀을 다시 고를 수 있습니다.',
  ];
}
