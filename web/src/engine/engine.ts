import { SPECIALTIES } from './teams';
import type {
  Bases, GameState, OutcomeCode, PendingModifier, Player,
  PlayCode, PlayEvent, StateSnapshot, StrategyResult, Team, TeamSide,
} from './types';

// 실제 야구는 타석의 약 65~68%가 아웃으로 끝난다. 2d6의 확률이 높은 중앙값
// (5~8)을 아웃 쪽에 몰아주고, 확률이 낮은 양 끝(2,3,11,12)에 희귀 이벤트를
// 배치해 "아웃은 흔하고 장타는 드문" 곡선을 만든다. 합계 하나당 결과 하나.
export const OUTCOME_TABLE: Record<number, OutcomeCode> = {
  2: 'DP', 3: '2B', 4: 'F', 5: 'G', 6: 'G', 7: 'K', 8: 'G', 9: '1B', 10: 'BB', 11: '3B', 12: 'HR',
};

export const OUTCOME_LABELS: Record<string, string> = {
  DP: '병살타 (더블플레이)',
  K: '삼진',
  F: '뜬공 아웃',
  G: '땅볼 아웃',
  '1B': '단타 (1루타)',
  '2B': '2루타',
  '3B': '3루타',
  BB: '볼넷',
  HR: '홈런',
};

// 비디오 판독 대상: 세이프/아웃이 갈리는 판정과 홈런-파울(뜬공) 경계만 리뷰 가능.
const REVIEWABLE_CODES = new Set<PlayCode>(['SB', 'CS', 'PO', 'HR', 'F']);

export function rollDice() {
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  return { d1, d2, sum: d1 + d2 };
}

export function createGame(awayTeam: Team, homeTeam: Team, maxInnings = 9): GameState {
  return {
    maxInnings,
    inning: 1,
    half: 'top',
    outs: 0,
    bases: [null, null, null],
    score: { away: 0, home: 0 },
    gameOver: false,
    lineups: { away: awayTeam.lineup, home: homeTeam.lineup },
    battingIndex: { away: 0, home: 0 },
    pitchers: { away: awayTeam.pitcher, home: homeTeam.pitcher },
    teamNames: { away: awayTeam.name, home: homeTeam.name },
    challenges: { away: 2, home: 2 },
    strategyUses: { away: 3, home: 3 },
    pendingModifier: null,
  };
}

export function battingTeam(state: GameState): TeamSide {
  return state.half === 'top' ? 'away' : 'home';
}

export function fieldingTeam(state: GameState): TeamSide {
  return state.half === 'top' ? 'home' : 'away';
}

function hasRunner(state: GameState): boolean {
  return state.bases.some(Boolean);
}

export function getCurrentBatter(state: GameState): Player {
  const team = battingTeam(state);
  return state.lineups[team][state.battingIndex[team]];
}

function getDefendingPitcher(state: GameState): Player {
  return state.pitchers[fieldingTeam(state)];
}

function specialtyOf(entity: Player | null | undefined) {
  return entity && entity.specialty ? SPECIALTIES[entity.specialty] : null;
}

// 인게임 문구는 실명 대신 타순으로 통일한다 (투수는 타석에 서지 않으니 '상대 투수').
export function nameOf(p: Player): string {
  return p.battingOrder !== null ? `${p.battingOrder}번타자` : '상대 투수';
}

// 볼/스트라이크 카운트는 실제 판정에 영향을 주지 않는 장식용 연출이다.
// 삼진은 스트라이크 3, 볼넷/몸에맞는공은 볼 4로 맞추고 나머지는 그럴듯한 값을 무작위로 채운다.
function generatePitchCount(code: PlayCode): { balls: number; strikes: number } {
  if (code === 'BB') return { balls: 4, strikes: Math.floor(Math.random() * 3) };
  if (code === 'K') return { balls: Math.floor(Math.random() * 3), strikes: 3 };
  return { balls: Math.floor(Math.random() * 4), strikes: Math.floor(Math.random() * 3) };
}

function advanceBattingIndex(state: GameState, team: TeamSide) {
  state.battingIndex[team] = (state.battingIndex[team] + 1) % state.lineups[team].length;
}

export function isReviewable(code: PlayCode): boolean {
  return REVIEWABLE_CODES.has(code);
}

// 판정을 누가 다툴 수 있는지: 아웃/뜬공은 공격팀이, 도루성공/홈런은 수비팀이 챌린지한다.
export function challengeSide(event: PlayEvent): TeamSide | null {
  if (event.code === 'CS' || event.code === 'PO' || event.code === 'F') return event.team;
  if (event.code === 'SB' || event.code === 'HR') return event.team === 'away' ? 'home' : 'away';
  return null;
}

function snapshotState(state: GameState): StateSnapshot {
  return {
    inning: state.inning,
    half: state.half,
    outs: state.outs,
    bases: state.bases.slice() as Bases,
    score: { away: state.score.away, home: state.score.home },
    gameOver: state.gameOver,
    battingIndex: { away: state.battingIndex.away, home: state.battingIndex.home },
  };
}

function restoreState(state: GameState, snap: StateSnapshot) {
  state.inning = snap.inning;
  state.half = snap.half;
  state.outs = snap.outs;
  state.bases = snap.bases.slice() as Bases;
  state.score = { away: snap.score.away, home: snap.score.home };
  state.gameOver = snap.gameOver;
  state.battingIndex = { away: snap.battingIndex.away, home: snap.battingIndex.home };
}

// 1루가 채워져 있을 때만 뒤 주자가 강제로 밀려나는 볼넷 포스 규칙
function applyWalk(bases: Bases, batter: Player) {
  const [r1, r2, r3] = bases;
  let runs = 0;
  const next: Bases = [batter, bases[1], bases[2]];
  if (r1) {
    if (r2) {
      if (r3) runs += 1;
      next[2] = r2;
    }
    next[1] = r1;
  }
  return { bases: next, runs };
}

// hitBases: 1=단타 2=2루타 3=3루타 4=홈런, 주자는 전원 동일하게 hitBases만큼 진루
function applyAdvance(bases: Bases, hitBases: number, batter: Player) {
  let runs = 0;
  const next: Bases = [null, null, null];
  for (let from = 0; from < 3; from++) {
    const runner = bases[from];
    if (!runner) continue;
    const to = from + hitBases;
    if (to >= 3) runs += 1;
    else next[to] = runner;
  }
  if (hitBases <= 3) {
    next[hitBases - 1] = batter;
  } else {
    runs += 1; // 홈런 타자 본인
  }
  return { bases: next, runs };
}

function applyDoublePlay(bases: Bases) {
  if (!bases[0]) return { bases: bases.slice() as Bases, extraOut: false };
  const next = bases.slice() as Bases;
  next[0] = null;
  return { bases: next, extraOut: true };
}

function applySacrifice(bases: Bases) {
  let runs = 0;
  const next: Bases = [null, null, null];
  for (let from = 0; from < 3; from++) {
    const runner = bases[from];
    if (!runner) continue;
    const to = from + 1;
    if (to >= 3) runs += 1;
    else next[to] = runner;
  }
  return { bases: next, runs };
}

// 1루 -> 다음 베이스로 향하는 주자 하나의 도루 결과를 적용한다.
// 자연발생 변수 이벤트, 감독의 치고달리기 지시, 챌린지로 판정이 뒤집힌 경우까지
// 전부 이 함수 하나로 처리한다 (성공/실패만 강제로 지정하면 됨).
function applyStealOutcome(state: GameState, fromIdx: number, runner: Player, success: boolean) {
  const toIdx = fromIdx + 1;
  const toName = toIdx === 1 ? '2루' : '3루';
  const bases = state.bases.slice() as Bases;
  bases[fromIdx] = null;
  if (success) {
    bases[toIdx] = runner;
    state.bases = bases;
    return { code: 'SB' as const, label: `도루 성공 - ${nameOf(runner)} (${toName})` };
  }
  state.bases = bases;
  state.outs += 1;
  return { code: 'CS' as const, label: `도루 실패 - ${nameOf(runner)} 아웃 (${toName})` };
}

function makeEvent(state: GameState, extra: Partial<PlayEvent> & { code: PlayCode; label: string }): PlayEvent {
  return {
    inning: state.inning,
    half: state.half,
    team: battingTeam(state),
    outsAfter: Math.min(state.outs, 3),
    basesAfter: state.bases.slice() as Bases,
    halfEnded: false,
    gameOver: false,
    runs: 0,
    isChaos: false,
    isStrategy: false,
    isReview: false,
    ...extra,
  };
}

function checkWalkoff(state: GameState, event: PlayEvent) {
  if (state.half === 'bottom' && state.inning >= state.maxInnings &&
      state.score.home > state.score.away) {
    state.gameOver = true;
    event.gameOver = true;
    event.walkoff = true;
  }
}

function endHalfInning(state: GameState, event: PlayEvent) {
  event.halfEnded = true;
  state.outs = 0;
  state.bases = [null, null, null];
  state.pendingModifier = null; // 다음 이닝으로 넘어가면 이번 타석용 지시 효과는 소멸

  if (state.half === 'top') {
    if (state.inning >= state.maxInnings && state.score.home > state.score.away) {
      state.gameOver = true;
      event.gameOver = true;
      return;
    }
    state.half = 'bottom';
    return;
  }

  if (state.inning >= state.maxInnings && state.score.home !== state.score.away) {
    state.gameOver = true;
    event.gameOver = true;
    return;
  }
  state.half = 'top';
  state.inning += 1;
}

// 이벤트 하나를 확정한다: 스코어보드에 남을 상태 스냅샷을 먼저 뜬 뒤,
// 그 결과로 아웃/이닝/경기가 끝났는지 확인한다 (순서가 바뀌면 스냅샷이 리셋된 값을 가리킨다).
function finalizeEvent(state: GameState, event: PlayEvent): PlayEvent {
  checkWalkoff(state, event);
  if (!state.gameOver && state.outs >= 3) {
    endHalfInning(state, event);
  }
  return event;
}

// KBO 팬들을 미치게 만드는 변수 이벤트. 주자가 있을 때만 굴리고, 기본 확률은
// 낮게 눌러 "가끔 한 번씩" 터지게 한다. 수비 투수의 제구불안 특기는 폭투를,
// 주자의 스피드스타 특기는 도루 시도/성공률을 끌어올린다.
export function tryChaosEvent(state: GameState): PlayEvent | null {
  if (!hasRunner(state)) return null;
  const snapshot = snapshotState(state);

  let stealFromIdx: number | null = null;
  if (state.bases[0] && !state.bases[1]) stealFromIdx = 0;
  else if (state.bases[1] && !state.bases[2]) stealFromIdx = 1;
  const stealRunner = stealFromIdx !== null ? state.bases[stealFromIdx] : null;
  const stealSpec = specialtyOf(stealRunner);

  const pitcher = getDefendingPitcher(state);
  const pitcherSpec = specialtyOf(pitcher);

  const wpChance = 0.02 + (pitcherSpec?.extraWildPitchChance ?? 0);
  const bkChance = 0.01;
  const poChance = 0.03;
  const sbChance = stealFromIdx !== null
    ? 0.08 + (stealSpec?.stealAttemptBonus ?? 0)
    : 0;

  const roll = Math.random();
  let cursor = 0;
  const team = battingTeam(state);

  cursor += wpChance;
  if (roll < cursor) {
    const [b1, b2, b3] = state.bases;
    const runs = b3 ? 1 : 0;
    state.bases = [null, b1, b2];
    state.score[team] += runs;
    return finalizeEvent(state, makeEvent(state, { code: 'WP', label: `${nameOf(pitcher)}의 폭투`, runs, isChaos: true, snapshot }));
  }

  cursor += bkChance;
  if (roll < cursor) {
    const [b1, b2, b3] = state.bases;
    const runs = b3 ? 1 : 0;
    state.bases = [null, b1, b2];
    state.score[team] += runs;
    return finalizeEvent(state, makeEvent(state, { code: 'BK', label: `${nameOf(pitcher)}의 보크`, runs, isChaos: true, snapshot }));
  }

  cursor += poChance;
  if (roll < cursor) {
    const idx = state.bases[2] ? 2 : state.bases[1] ? 1 : 0;
    const runnerOut = state.bases[idx]!;
    const baseName = ['1루', '2루', '3루'][idx];
    const bases = state.bases.slice() as Bases;
    bases[idx] = null;
    state.bases = bases;
    state.outs += 1;
    return finalizeEvent(state, makeEvent(state, {
      code: 'PO', label: `견제사 - ${nameOf(runnerOut)} (${baseName})`, isChaos: true,
      snapshot, meta: { runner: runnerOut },
    }));
  }

  cursor += sbChance;
  if (roll < cursor && stealFromIdx !== null && stealRunner) {
    const successChance = 0.70 + (stealSpec?.stealSuccessBonus ?? 0);
    const { code, label } = applyStealOutcome(state, stealFromIdx, stealRunner, Math.random() < successChance);
    return finalizeEvent(state, makeEvent(state, {
      code, label, isChaos: true, snapshot, meta: { runner: stealRunner, fromIdx: stealFromIdx },
    }));
  }

  return null; // 나머지는 아무 일 없음
}

// code 하나가 결정된 뒤의 순수 기계적 처리(주자 진루/아웃 수/문구).
// 자연 굴림, 감독 지시(번트/고의4구), 챌린지 재적용까지 전부 여기로 모인다.
function applyBatterOutcome(state: GameState, code: PlayCode, batter: Player, opts: { noFlavor?: boolean } = {}) {
  let label = OUTCOME_LABELS[code] || code;
  let runs = 0;
  let outsAdded = 0;

  switch (code) {
    case 'K':
      outsAdded = 1;
      break;
    case 'F': {
      outsAdded = 1;
      // 이미 2아웃이면 이 아웃으로 이닝이 끝나므로, 잡히는 순간 득점 기회 자체가 사라진다
      // (실제 야구에서도 3아웃째 태그업은 득점으로 인정되지 않는다).
      if (state.outs < 2) {
        if (state.bases[2]) {
          // 3루 주자 태그업 - 웬만큼 깊은 뜬공이면 대부분 득점한다 (희생플라이).
          if (Math.random() < 0.75) {
            const runner = state.bases[2]!;
            const bases = state.bases.slice() as Bases;
            bases[2] = null;
            state.bases = bases;
            runs = 1;
            label = `희생플라이 - ${nameOf(runner)} 태그업 득점`;
          }
        } else if (state.bases[1]) {
          // 2루 주자는 3루까지 태그업 - 3루보다는 덜 확실하다.
          if (Math.random() < 0.35) {
            const runner = state.bases[1]!;
            const bases = state.bases.slice() as Bases;
            bases[1] = null;
            bases[2] = runner;
            state.bases = bases;
            label = `뜬공 아웃 - ${nameOf(runner)} 태그업 3루 진루`;
          }
        }
      }
      break;
    }
    case 'G': {
      // 1루가 비어 있고 2·3루에 주자가 있을 때, 8% 확률로 타구가 주자를 맞힌다.
      const canHitRunner = !state.bases[0] && (state.bases[1] || state.bases[2]);
      if (!opts.noFlavor && canHitRunner && Math.random() < 0.08) {
        const idx = state.bases[2] ? 2 : 1;
        const hitRunner = state.bases[idx]!;
        const baseName = idx === 2 ? '3루' : '2루';
        const bases = state.bases.slice() as Bases;
        bases[idx] = null;
        bases[0] = batter;
        state.bases = bases;
        outsAdded = 1;
        label = `타구에 맞은 ${nameOf(hitRunner)} 아웃 (${baseName}), 타자는 1루 출루`;
      } else {
        outsAdded = 1;
        // 이미 2아웃이면 진루타로 벌 시간이 없다 (아웃되는 순간 이닝 종료).
        if (state.outs < 2) {
          if (state.bases[2]) {
            // 3루 주자 - 우익 방향 땅볼 등으로 득점하는 "진루타".
            if (Math.random() < 0.55) {
              const runner = state.bases[2]!;
              const bases = state.bases.slice() as Bases;
              bases[2] = null;
              state.bases = bases;
              runs = 1;
              label = `진루타 - ${nameOf(runner)} 득점 (땅볼)`;
            }
          } else if (state.bases[1] && !state.bases[0]) {
            // 1루가 비어 있어 포스아웃이 아닐 때만, 2루 주자가 3루까지 갈 여지가 있다.
            if (Math.random() < 0.3) {
              const runner = state.bases[1]!;
              const bases = state.bases.slice() as Bases;
              bases[1] = null;
              bases[2] = runner;
              state.bases = bases;
              label = `진루타 - ${nameOf(runner)} 3루 진루 (땅볼)`;
            }
          }
        }
      }
      break;
    }
    case 'DP': {
      const { bases, extraOut } = applyDoublePlay(state.bases);
      state.bases = bases;
      outsAdded = extraOut ? 2 : 1;
      // 1루 주자가 없으면 병살이 성립하지 않는다 - 그냥 타자만 아웃되는 땅볼로 표기한다.
      if (!extraOut) label = OUTCOME_LABELS.G;
      break;
    }
    case 'BB': {
      if (!opts.noFlavor) {
        const pitcherSpec = specialtyOf(getDefendingPitcher(state));
        const hbpChance = 0.20 + (pitcherSpec?.extraHbpChance ?? 0);
        if (Math.random() < hbpChance) label = '몸에 맞는 공';
      }
      const { bases, runs: r } = applyWalk(state.bases, batter);
      state.bases = bases;
      runs = r;
      break;
    }
    case 'SAC_OK': {
      const { bases, runs: r } = applySacrifice(state.bases);
      state.bases = bases;
      runs = r;
      outsAdded = 1;
      label = '희생번트 성공 - 주자 진루';
      break;
    }
    case 'SAC_FAIL':
      outsAdded = 1;
      label = '번트 실패 - 타자 아웃';
      break;
    case '1B': {
      const { bases, runs: r } = applyAdvance(state.bases, 1, batter);
      state.bases = bases;
      runs = r;
      break;
    }
    case '2B': {
      const { bases, runs: r } = applyAdvance(state.bases, 2, batter);
      state.bases = bases;
      runs = r;
      break;
    }
    case '3B': {
      const { bases, runs: r } = applyAdvance(state.bases, 3, batter);
      state.bases = bases;
      runs = r;
      break;
    }
    case 'HR': {
      const { bases, runs: r } = applyAdvance(state.bases, 4, batter);
      state.bases = bases;
      runs = r;
      break;
    }
  }

  return { label, runs, outsAdded };
}

// 부스트형 감독 지시(강공/선구안/시프트/마운드방문)를 다음 타석 결과에 1회 반영한다.
function applyPendingModifier(mod: PendingModifier, code: PlayCode): { changed: boolean; code?: OutcomeCode } {
  const isOut = code === 'K' || code === 'F' || code === 'G' || code === 'DP';
  const contactHit = code === '1B' || code === '2B' || code === '3B';
  const anyHitLike = contactHit || code === 'HR' || code === 'BB';

  if (mod.kind === 'upgrade' && isOut && Math.random() < mod.chance) {
    return { changed: true, code: mod.to };
  }
  if (mod.kind === 'downgrade') {
    const eligible = mod.onlyContact ? contactHit : anyHitLike;
    if (eligible && Math.random() < mod.chance) {
      return { changed: true, code: mod.to };
    }
  }
  return { changed: false };
}

export function resolveBatterRoll(state: GameState): PlayEvent {
  const snapshot = snapshotState(state);
  const { d1, d2, sum } = rollDice();
  const team = battingTeam(state);
  const batter = getCurrentBatter(state);
  const pitcher = getDefendingPitcher(state);
  const batterSpec = specialtyOf(batter);
  const pitcherSpec = specialtyOf(pitcher);

  let code: PlayCode = OUTCOME_TABLE[sum];
  let feat: string | null = null;

  // 1) 타자 특기: 아웃을 더 좋은 결과로 격상
  const isOut = code === 'K' || code === 'F' || code === 'G' || code === 'DP';
  if (isOut && batterSpec?.outUpgradeChance && Math.random() < batterSpec.outUpgradeChance) {
    code = batterSpec.outUpgradeTo!;
    feat = `${nameOf(batter)}의 ${batterSpec.label}`;
  }

  // 2) 투수 특기: 출루성 결과를 다시 억누름
  const isHitLike = code === '1B' || code === '2B' || code === '3B' || code === 'HR' || code === 'BB';
  if (pitcherSpec?.hitDowngradeChance && isHitLike && Math.random() < pitcherSpec.hitDowngradeChance) {
    code = pitcherSpec.hitDowngradeTo!;
    feat = `${nameOf(pitcher)}의 ${pitcherSpec.label}`;
  } else if (pitcherSpec?.hrSuppressChance && code === 'HR' && Math.random() < pitcherSpec.hrSuppressChance) {
    code = 'G';
    feat = `${nameOf(pitcher)}의 ${pitcherSpec.label}`;
  }

  // 3) 감독의 부스트형 지시 (있다면 1회 소모)
  if (state.pendingModifier) {
    const applied = applyPendingModifier(state.pendingModifier, code);
    if (applied.changed && applied.code) {
      code = applied.code;
      feat = state.pendingModifier.feat;
    }
    state.pendingModifier = null;
  }

  const { label, runs, outsAdded } = applyBatterOutcome(state, code, batter);
  const finalLabel = feat ? `${label} (${feat} 발동!)` : label;
  const pitchCount = generatePitchCount(code);

  state.outs += outsAdded;
  state.score[team] += runs;
  advanceBattingIndex(state, team);

  return finalizeEvent(state, makeEvent(state, {
    d1, d2, sum, code, label: finalLabel, runs, batterName: nameOf(batter), pitchCount, snapshot,
  }));
}

// 비디오 판독. 성공 확률(45%)로 판정을 뒤집는다: 상태를 판정 직전으로 되돌린 뒤
// 반대 결과를 강제로 적용한다. 실패하면 원래 결과 그대로 유지.
export function attemptChallenge(state: GameState, event: PlayEvent): { overturned: boolean; newEvent?: PlayEvent } {
  if (Math.random() >= 0.45) return { overturned: false };
  if (!event.snapshot) return { overturned: false };

  restoreState(state, event.snapshot);
  let newEvent: PlayEvent | undefined;

  if (event.code === 'SB' || event.code === 'CS') {
    const { runner, fromIdx } = event.meta!;
    const wantSuccess = event.code === 'CS';
    const { code, label } = applyStealOutcome(state, fromIdx!, runner!, wantSuccess);
    newEvent = finalizeEvent(state, makeEvent(state, { code, label: `[판독 번복] ${label}`, isChaos: true, isReview: true }));
  } else if (event.code === 'PO') {
    // 복원된 상태 자체가 이미 세이프 상황이라 추가 처리가 필요 없다.
    newEvent = finalizeEvent(state, makeEvent(state, {
      code: 'PO_SAFE', label: `[판독 번복] ${nameOf(event.meta!.runner!)} 세이프 처리`, isChaos: true, isReview: true,
    }));
  } else if (event.code === 'HR' || event.code === 'F') {
    const batter = getCurrentBatter(state);
    const wantCode: PlayCode = event.code === 'HR' ? 'F' : 'HR';
    const { label, runs, outsAdded } = applyBatterOutcome(state, wantCode, batter, { noFlavor: true });
    state.outs += outsAdded;
    state.score[battingTeam(state)] += runs;
    advanceBattingIndex(state, battingTeam(state));
    newEvent = finalizeEvent(state, makeEvent(state, {
      code: wantCode, label: `[판독 번복] ${label}`, runs, batterName: nameOf(batter), isReview: true,
    }));
  }

  return { overturned: true, newEvent };
}

interface StrategyDef {
  key: string;
  label: string;
  applicable: (state: GameState) => boolean;
  execute: (state: GameState) => { plays: PlayEvent[]; continueToBatter: boolean; skipChaos: boolean };
}

// 감독 전략: 공격/수비 요청 시 상황에 맞는 작전 중 하나가 무작위로 발동한다.
// 즉발형(번트/고의4구 등)은 플레이 이벤트를 바로 만들고, 부스트형(강공/시프트 등)은
// pendingModifier만 걸어두고 다음 타석 굴림에서 소모된다.
const OFFENSE_STRATEGIES: StrategyDef[] = [
  {
    key: 'BUNT', label: '번트/스퀴즈 지시',
    applicable: (state) => hasRunner(state),
    execute: (state) => {
      const batter = getCurrentBatter(state);
      const team = battingTeam(state);
      const code: PlayCode = Math.random() < 0.8 ? 'SAC_OK' : 'SAC_FAIL';
      const { label, runs, outsAdded } = applyBatterOutcome(state, code, batter);
      state.outs += outsAdded;
      state.score[team] += runs;
      advanceBattingIndex(state, team);
      const event = finalizeEvent(state, makeEvent(state, {
        code, label: `[감독 전략: 번트] ${label}`, runs, batterName: nameOf(batter), isStrategy: true,
      }));
      return { plays: [event], continueToBatter: false, skipChaos: true };
    },
  },
  {
    key: 'HIT_AND_RUN', label: '치고달리기 지시',
    applicable: (state) => Boolean(state.bases[0]) && !state.bases[1],
    execute: (state) => {
      const runner = state.bases[0]!;
      const { code, label } = applyStealOutcome(state, 0, runner, Math.random() < 0.80);
      const event = finalizeEvent(state, makeEvent(state, {
        code, label: `[감독 전략: 치고달리기] ${label}`, isChaos: true, isStrategy: true,
        meta: { runner, fromIdx: 0 },
      }));
      return { plays: [event], continueToBatter: true, skipChaos: true };
    },
  },
  {
    key: 'SWING_AWAY', label: '강공 지시',
    applicable: () => true,
    execute: (state) => {
      state.pendingModifier = { kind: 'upgrade', chance: 0.15, to: 'HR', feat: '감독의 강공 지시' };
      return { plays: [], continueToBatter: true, skipChaos: false };
    },
  },
  {
    key: 'PATIENT', label: '선구안 지시',
    applicable: () => true,
    execute: (state) => {
      state.pendingModifier = { kind: 'upgrade', chance: 0.30, to: 'BB', feat: '감독의 선구안 지시' };
      return { plays: [], continueToBatter: true, skipChaos: false };
    },
  },
];

const DEFENSE_STRATEGIES: StrategyDef[] = [
  {
    key: 'IBB', label: '고의 4구 지시',
    applicable: () => true,
    execute: (state) => {
      const batter = getCurrentBatter(state);
      const team = battingTeam(state);
      const { label, runs, outsAdded } = applyBatterOutcome(state, 'BB', batter, { noFlavor: true });
      state.outs += outsAdded;
      state.score[team] += runs;
      advanceBattingIndex(state, team);
      const event = finalizeEvent(state, makeEvent(state, {
        code: 'BB', label: `[감독 전략: 고의 4구] ${label}`, runs, batterName: nameOf(batter), isStrategy: true,
      }));
      return { plays: [event], continueToBatter: false, skipChaos: true };
    },
  },
  {
    key: 'PICKOFF_BARRAGE', label: '총력 견제 지시',
    applicable: (state) => hasRunner(state),
    execute: (state) => {
      const idx = state.bases[2] ? 2 : state.bases[1] ? 1 : 0;
      const runner = state.bases[idx]!;
      const baseName = ['1루', '2루', '3루'][idx];
      let event: PlayEvent;
      if (Math.random() < 0.5) {
        const bases = state.bases.slice() as Bases;
        bases[idx] = null;
        state.bases = bases;
        state.outs += 1;
        event = finalizeEvent(state, makeEvent(state, {
          code: 'PO', label: `[감독 전략: 총력 견제] ${nameOf(runner)} 아웃 (${baseName})`, isChaos: true, isStrategy: true,
          meta: { runner },
        }));
      } else {
        event = finalizeEvent(state, makeEvent(state, {
          code: 'PO_MISS', label: `[감독 전략: 총력 견제] 견제 실패 - ${nameOf(runner)} 생존`, isChaos: true, isStrategy: true,
        }));
      }
      return { plays: [event], continueToBatter: true, skipChaos: true };
    },
  },
  {
    key: 'SHIFT', label: '수비 시프트 지시',
    applicable: () => true,
    execute: (state) => {
      state.pendingModifier = { kind: 'downgrade', chance: 0.25, to: 'G', onlyContact: true, feat: '감독의 수비 시프트' };
      return { plays: [], continueToBatter: true, skipChaos: false };
    },
  },
  {
    key: 'MOUND_VISIT', label: '마운드 방문',
    applicable: () => true,
    execute: (state) => {
      state.pendingModifier = { kind: 'downgrade', chance: 0.20, to: 'K', feat: '마운드 방문 효과' };
      return { plays: [], continueToBatter: true, skipChaos: false };
    },
  },
];

export function useStrategy(state: GameState, side: 'offense' | 'defense'): StrategyResult {
  const pool = side === 'offense' ? OFFENSE_STRATEGIES : DEFENSE_STRATEGIES;
  const applicable = pool.filter((s) => s.applicable(state));
  const choice = applicable[Math.floor(Math.random() * applicable.length)];
  const result = choice.execute(state);
  return { chosenKey: choice.key, chosenLabel: choice.label, ...result };
}

// 한 타자의 턴을 진행한다 (챌린지/전략 없이 단순 진행 — 시뮬레이션/CPU용).
export function playAtBat(state: GameState, options: { chaos?: boolean } = {}) {
  if (state.gameOver) throw new Error('경기가 이미 종료되었습니다');
  const chaosEnabled = options.chaos !== false;
  const plays: PlayEvent[] = [];

  if (chaosEnabled) {
    const chaosEvent = tryChaosEvent(state);
    if (chaosEvent) plays.push(chaosEvent);
  }

  const halfAlreadyEnded = plays.length > 0 && plays[plays.length - 1].halfEnded;
  if (!state.gameOver && !halfAlreadyEnded) {
    plays.push(resolveBatterRoll(state));
  }

  return { plays, gameOver: state.gameOver };
}
