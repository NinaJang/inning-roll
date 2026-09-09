import { create } from 'zustand';
import { battingTeam, createGame, fieldingTeam } from '../engine/engine';
import { runTurn, type TurnYield } from '../engine/turnController';
import type { GameState, PlayEvent, Team, TeamSide } from '../engine/types';

export type Screen = 'select' | 'play' | 'over';

export interface LogEntry {
  id: number;
  play?: PlayEvent;
  note?: string;
}

export interface PendingChallenge {
  play: PlayEvent;
  side: TeamSide;
}

export interface PendingStrategyAnnounce {
  chosenLabel: string;
  boostOnly: boolean;
  resultLabel?: string;
  side: 'offense' | 'defense';
}

interface GameStore {
  screen: Screen;
  game: GameState | null;
  log: LogEntry[];
  pendingChallenge: PendingChallenge | null;
  pendingStrategyAnnounce: PendingStrategyAnnounce | null;
  fastForward: boolean;

  turnGen: Generator<TurnYield, void, boolean> | null;
  autoTimer: number | null;
  logCounter: number;

  startGame: (away: Team, home: Team, innings: number) => void;
  advance: () => void;
  callStrategy: (side: 'offense' | 'defense') => void;
  resolveChallenge: (accepted: boolean) => void;
  dismissStrategyAnnounce: () => void;
  toggleFastForward: () => void;
  restart: () => void;
}

const AUTO_DELAY_MS = 700;

export const useGameStore = create<GameStore>((set, get) => {
  function clearAutoTimer() {
    const t = get().autoTimer;
    if (t !== null) {
      window.clearTimeout(t);
      set({ autoTimer: null });
    }
  }

  function appendLog(play: PlayEvent) {
    const id = get().logCounter + 1;
    set((s) => ({ log: [{ id, play }, ...s.log], logCounter: id }));
  }

  function appendNote(note: string) {
    const id = get().logCounter + 1;
    set((s) => ({ log: [{ id, note }, ...s.log], logCounter: id }));
  }

  function scheduleAutoAdvanceIfNeeded() {
    if (!get().fastForward) return;
    const game = get().game;
    if (!game || game.gameOver) return;
    if (get().pendingChallenge || get().pendingStrategyAnnounce) return;
    const t = window.setTimeout(() => get().advance(), AUTO_DELAY_MS);
    set({ autoTimer: t });
  }

  function processYield(result: IteratorResult<TurnYield, void>) {
    if (result.done) {
      set({ turnGen: null, game: { ...get().game! } });
      if (get().game!.gameOver) {
        set({ screen: 'over' });
        return;
      }
      scheduleAutoAdvanceIfNeeded();
      return;
    }

    const y = result.value;
    if (y.kind === 'strategy') {
      set({
        pendingStrategyAnnounce: {
          chosenLabel: y.chosenLabel,
          boostOnly: y.boostOnly,
          resultLabel: y.resultLabel,
          side: y.side,
        },
      });
      return; // 전략 발동은 항상 모달로 멈춘다 (자동모드여도 사용자가 직접 연 것이므로)
    }

    appendLog(y.play);

    // 이닝의 초/말이 바뀌는 순간을 놓치지 않도록 눈에 띄는 안내를 남긴다.
    if (y.play.halfEnded && !y.play.gameOver) {
      const g = get().game!;
      const endHalf = y.play.half === 'top' ? '초' : '말';
      const newHalf = g.half === 'top' ? '초' : '말';
      appendNote(`🔄 ${y.play.inning}회 ${endHalf} 종료 → ${g.inning}회 ${newHalf} 시작`);
    }

    set({ game: { ...get().game! } });

    if (y.needsChallenge && y.side) {
      set({ pendingChallenge: { play: y.play, side: y.side } });
      return; // 챌린지는 항상 사용자 결정을 기다린다
    }

    if (get().fastForward) {
      scheduleAutoAdvanceIfNeeded();
      return;
    }

    // 수동 모드: 챌린지가 필요 없는 결과는 곧바로 이어서 처리한다. 그렇지 않으면
    // "다음 진행 -> 아무 변화 없이 버튼만 다시 활성화" 같은, 클릭해도 아무 것도
    // 안 보이는 구간이 생긴다 - 다음 챌린지가 나오거나 턴이 끝날 때까지 이어간다.
    const gen = get().turnGen;
    if (gen) processYield(gen.next(false));
  }

  return {
    screen: 'select',
    game: null,
    log: [],
    pendingChallenge: null,
    pendingStrategyAnnounce: null,
    fastForward: false,
    turnGen: null,
    autoTimer: null,
    logCounter: 0,

    startGame: (away, home, innings) => {
      clearAutoTimer();
      set({
        game: createGame(away, home, innings),
        screen: 'play',
        log: [],
        pendingChallenge: null,
        pendingStrategyAnnounce: null,
        fastForward: false,
        turnGen: null,
        logCounter: 0,
      });
    },

    advance: () => {
      clearAutoTimer();
      const { game, turnGen, pendingChallenge, pendingStrategyAnnounce } = get();
      if (!game || game.gameOver || pendingChallenge || pendingStrategyAnnounce) return;
      if (turnGen) {
        processYield(turnGen.next(false));
        return;
      }
      const gen = runTurn(game, null);
      set({ turnGen: gen });
      processYield(gen.next());
    },

    callStrategy: (side) => {
      clearAutoTimer();
      const { game, turnGen, pendingChallenge, pendingStrategyAnnounce } = get();
      if (!game || game.gameOver || turnGen || pendingChallenge || pendingStrategyAnnounce) return;
      const team = side === 'offense' ? battingTeam(game) : fieldingTeam(game);
      if (game.strategyUses[team] <= 0) return;

      set({ fastForward: false }); // 전략을 쓰는 순간은 결과를 직접 보도록 수동 모드로 전환
      game.strategyUses[team] -= 1;
      const gen = runTurn(game, side);
      set({ turnGen: gen, game: { ...game } });
      processYield(gen.next());
    },

    resolveChallenge: (accepted) => {
      const { turnGen, pendingChallenge } = get();
      set({ pendingChallenge: null });
      if (!turnGen || !pendingChallenge) return;

      if (!accepted) {
        processYield(turnGen.next(false));
        return;
      }

      const side = pendingChallenge.side;
      const result = turnGen.next(true);
      const overturned = !result.done && result.value.kind === 'play' && result.value.play.isReview;

      if (overturned) {
        appendNote('📺 판독 결과: 번복! (챌린지 횟수 유지)');
      } else {
        appendNote(`📺 판독 결과: 원심 유지 (잔여 ${get().game!.challenges[side]}회)`);
      }
      processYield(result);
    },

    dismissStrategyAnnounce: () => {
      const { turnGen } = get();
      set({ pendingStrategyAnnounce: null });
      if (!turnGen) return;
      processYield(turnGen.next(true));
    },

    toggleFastForward: () => {
      set((s) => ({ fastForward: !s.fastForward }));
      const s = get();
      if (s.fastForward && !s.turnGen && !s.pendingChallenge && !s.pendingStrategyAnnounce && s.game && !s.game.gameOver) {
        s.advance();
      }
    },

    restart: () => {
      clearAutoTimer();
      set({
        screen: 'select',
        game: null,
        log: [],
        pendingChallenge: null,
        pendingStrategyAnnounce: null,
        fastForward: false,
        turnGen: null,
        logCounter: 0,
      });
    },
  };
});
