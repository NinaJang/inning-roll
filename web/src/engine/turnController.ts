import {
  attemptChallenge, battingTeam, challengeSide, fieldingTeam,
  isReviewable, resolveBatterRoll, tryChaosEvent, useStrategy,
} from './engine';
import type { GameState, PlayEvent, TeamSide } from './types';

export type TurnYield =
  | { kind: 'strategy'; chosenLabel: string; boostOnly: boolean; resultLabel?: string; side: 'offense' | 'defense' }
  | { kind: 'play'; play: PlayEvent; needsChallenge: boolean; side?: TeamSide };

// 플레이 하나를 표시하고, 리뷰 가능하면 사용자의 챌린지 결정을 기다린다.
// 리턴값: 이 플레이(혹은 챌린지로 번복된 결과)로 이닝/경기가 끝났는지 여부.
function* presentPlay(state: GameState, play: PlayEvent): Generator<TurnYield, boolean, boolean> {
  const side = isReviewable(play.code) ? challengeSide(play) : null;
  const canChallenge = side !== null && state.challenges[side] > 0;

  const wantsChallenge = yield { kind: 'play', play, needsChallenge: canChallenge, side: side ?? undefined };

  if (canChallenge && wantsChallenge) {
    const result = attemptChallenge(state, play);
    if (result.overturned && result.newEvent) {
      yield { kind: 'play', play: result.newEvent, needsChallenge: false };
      return Boolean(result.newEvent.halfEnded || result.newEvent.gameOver);
    }
    state.challenges[side!] -= 1;
    return Boolean(play.halfEnded || play.gameOver);
  }

  return Boolean(play.halfEnded || play.gameOver);
}

// 한 타자의 턴을 진행한다: side가 있으면 감독 전략부터 발동시키고,
// 이어서(적용 가능하면) 변수 이벤트 -> 타석 굴림 순서로 진행한다.
// CLI의 runTurn/resolvePlayWithChallenge와 동일한 시퀀싱을 제너레이터로 표현한 것.
export function* runTurn(state: GameState, side: 'offense' | 'defense' | null): Generator<TurnYield, void, boolean> {
  let continueToBatter = true;
  let skipChaos = false;

  if (side) {
    const result = useStrategy(state, side);
    yield {
      kind: 'strategy',
      chosenLabel: result.chosenLabel,
      boostOnly: result.plays.length === 0,
      resultLabel: result.plays[0]?.label,
      side,
    };

    for (const p of result.plays) {
      const halted = yield* presentPlay(state, p);
      if (state.gameOver || halted) {
        continueToBatter = false;
        break;
      }
    }
    if (!result.continueToBatter) continueToBatter = false;
    skipChaos = result.skipChaos;
  }

  if (!continueToBatter || state.gameOver) return;

  if (!skipChaos) {
    const chaosEvent = tryChaosEvent(state);
    if (chaosEvent) {
      const halted = yield* presentPlay(state, chaosEvent);
      if (state.gameOver || halted) return;
    }
  }

  if (state.gameOver) return;
  const batterEvent = resolveBatterRoll(state);
  yield* presentPlay(state, batterEvent);
}

export function currentSideTeam(state: GameState, side: 'offense' | 'defense'): TeamSide {
  return side === 'offense' ? battingTeam(state) : fieldingTeam(state);
}
