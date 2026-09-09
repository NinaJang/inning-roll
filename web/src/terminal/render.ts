// cli.js의 콘솔 출력 포맷을 그대로 이식한 순수 렌더 함수들.
// console.log 대신 "세그먼트 배열(줄) 목록"을 리턴해서 부분별로 색을 입힐 수 있게 한다.
import { battingTeam, getCurrentBatter, nameOf } from '../engine/engine';
import { SPECIALTIES, TEAM_LIST } from '../engine/teams';
import type { Bases, GameState, PlayEvent, TeamSide } from '../engine/types';

export interface Segment {
  text: string;
  cls?: string;
}
export type Line = Segment[];

// 일반 진행 멘트는 흰색이 기본값이고, 팀명/이벤트성 문구에만 별도 색을 준다.
export const COLOR = {
  chaos: 'text-yellow-400',
  strategy: 'text-violet-400',
  review: 'text-cyan-400',
  system: 'text-pink-400',
  success: 'text-emerald-400',
  dim: 'text-neutral-500',
  danger: 'text-red-400',
};

const TEAM_COLOR_BY_NAME: Record<string, string> = Object.fromEntries(
  TEAM_LIST.map((t) => [t.name, t.color]),
);

export function seg(text: string, cls?: string): Segment {
  return { text, cls };
}

// 원정/홈 역할이 아니라 구단마다 고정된 고유 색을 쓴다 (teams.ts의 color 필드).
export function teamSeg(name: string): Segment {
  return seg(name, TEAM_COLOR_BY_NAME[name]);
}

export function plain(text: string): Line {
  return [seg(text)];
}

export function renderTeamList(): Line[] {
  const lines: Line[] = [[]];
  TEAM_LIST.forEach((t, i) => {
    const specs = t.lineup
      .filter((p) => p.specialty)
      .map((p) => `${p.name}(${SPECIALTIES[p.specialty!].label})`)
      .join(', ');
    const pitcherSpec = t.pitcher.specialty
      ? `${t.pitcher.name}(${SPECIALTIES[t.pitcher.specialty].label})`
      : `${t.pitcher.name}(특기 없음)`;
    lines.push([seg(`  ${i + 1}. ${t.name} — ${t.tagline}`)]);
    lines.push([seg(`     타자 특기: ${specs || '없음'}`)]);
    lines.push([seg(`     선발투수: ${pitcherSpec}`)]);
  });
  return lines;
}

// 다이아몬드는 좌우 대칭(중심 기준 ±4칸)으로 맞춘다. 점유된 베이스는 밝게, 빈 베이스는 흐리게.
function basesAsciiLines(bases: Bases): Line[] {
  const dot = (occupied: boolean) => seg(occupied ? '●' : '○', occupied ? undefined : COLOR.dim);
  return [
    [seg('        '), dot(Boolean(bases[1]))],
    [seg('    '), dot(Boolean(bases[2])), seg('       '), dot(Boolean(bases[0]))],
    [seg('        ⌂', COLOR.dim)],
  ];
}

function runnerSummaryLine(bases: Bases): Line {
  const labels = ['1루', '2루', '3루'];
  const names = bases.map((r, i) => (r ? `${labels[i]}:${nameOf(r)}` : null)).filter(Boolean);
  return plain(names.length ? `주자 - ${names.join(', ')}` : '주자 없음');
}

export function renderBoard(game: GameState): Line[] {
  const batter = getCurrentBatter(game);
  const spec = batter.specialty ? ` [${SPECIALTIES[batter.specialty].label}]` : '';
  const battingSide = battingTeam(game);
  const halfLabel = `${game.inning}회 ${game.half === 'top' ? '초' : '말'}`;

  return [
    [],
    [
      seg(`${halfLabel}  |  아웃 ${Math.min(game.outs, 3)}  |  `),
      teamSeg(game.teamNames.away),
      seg(` ${game.score.away} : ${game.score.home} `),
      teamSeg(game.teamNames.home),
    ],
    ...basesAsciiLines(game.bases),
    runnerSummaryLine(game.bases),
    [
      seg('타석 - '),
      seg(`${nameOf(batter)}${spec}`),
      seg(' ('),
      teamSeg(game.teamNames[battingSide]),
      seg(')'),
    ],
    [
      seg('챌린지 - '),
      teamSeg(game.teamNames.away), seg(` ${game.challenges.away} / `),
      teamSeg(game.teamNames.home), seg(` ${game.challenges.home}`),
    ],
    [
      seg('전략 - '),
      teamSeg(game.teamNames.away), seg(` ${game.strategyUses.away} / `),
      teamSeg(game.teamNames.home), seg(` ${game.strategyUses.home}`),
    ],
  ];
}

export function renderPlay(play: PlayEvent, game: GameState): Line[] {
  const runsSeg = play.runs > 0 ? seg(`  [+${play.runs}점]`, COLOR.success) : null;
  const countSeg = play.pitchCount ? seg(`  (${play.pitchCount.balls}B ${play.pitchCount.strikes}S)`, COLOR.dim) : null;
  const team = game.teamNames[play.team];
  const tail = [runsSeg, countSeg].filter((s): s is Segment => s !== null);

  if (play.isReview) {
    return [[seg('📺 '), seg(play.label, COLOR.review), ...tail]];
  }
  if (play.isChaos) {
    return [[seg('⚡ '), teamSeg(team), seg(' '), seg(play.label, COLOR.chaos), ...tail]];
  }
  if (play.d1 !== undefined) {
    return [[
      seg('🎲 '), seg(`${play.d1}+${play.d2}=${play.sum} → `),
      seg(play.label),
      seg(' ('), seg(play.batterName ?? ''), seg(', '), teamSeg(team), seg(')'),
      ...tail,
    ]];
  }
  // 즉발형 감독 전략(번트/고의4구) 결과
  return [[
    seg('📋 '), seg(play.label, COLOR.strategy),
    seg(' ('), seg(play.batterName ?? ''), seg(', '), teamSeg(team), seg(')'),
    ...tail,
  ]];
}

export function renderHalfTransition(play: PlayEvent, game: GameState): Line[] {
  const endHalf = play.half === 'top' ? '초' : '말';
  const newHalf = game.half === 'top' ? '초' : '말';
  return [[seg(`🔄 ${play.inning}회 ${endHalf} 종료 → ${game.inning}회 ${newHalf} 시작`, COLOR.system)]];
}

export function renderFinish(game: GameState): Line[] {
  const { away, home } = game.score;
  const winnerSide: TeamSide | null = away === home ? null : away > home ? 'away' : 'home';
  return [
    [],
    [seg('=== 경기 종료 ===', COLOR.system)],
    [
      seg('최종 스코어  '),
      teamSeg(game.teamNames.away), seg(` ${away} : ${home} `),
      teamSeg(game.teamNames.home),
    ],
    winnerSide ? [teamSeg(game.teamNames[winnerSide]), seg(' 승리')] : plain('무승부'),
    [],
    plain('"다시하기"를 눌러 팀을 다시 고를 수 있습니다.'),
  ];
}
