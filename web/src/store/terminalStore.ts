import { create } from 'zustand';
import { battingTeam, createGame, fieldingTeam } from '../engine/engine';
import { runTurn, type TurnYield } from '../engine/turnController';
import type { GameState, PlayEvent, TeamSide } from '../engine/types';
import { TEAM_LIST } from '../engine/teams';
import { renderBoard, renderFinish, renderHalfTransition, renderPlay, renderTeamList } from '../terminal/render';

export type Mode = 'pick-away' | 'pick-home' | 'pick-innings' | 'command' | 'challenge' | 'over';

interface PendingChallenge {
  play: PlayEvent;
  side: TeamSide;
}

interface TerminalStore {
  lines: string[];
  mode: Mode;
  awayId: string | null;
  homeId: string | null;
  game: GameState | null;
  turnGen: Generator<TurnYield, void, boolean> | null;
  pendingChallenge: PendingChallenge | null;
  fastForward: boolean;
  autoTimer: number | null;

  submit: (raw: string) => void;
  toggleFastForward: () => void;
  restart: () => void;
}

const AUTO_DELAY_MS = 500;
const WELCOME = ['⚾ 이닝롤 — 터미널 모드', '팀을 골라 경기를 시작합니다.'];

export const useTerminalStore = create<TerminalStore>((set, get) => {
  function print(newLines: string[]) {
    set((s) => ({ lines: [...s.lines, ...newLines] }));
  }

  function clearAutoTimer() {
    const t = get().autoTimer;
    if (t !== null) {
      window.clearTimeout(t);
      set({ autoTimer: null });
    }
  }

  // 한 커맨드 사이클(다음 진행/전략 지시)이 완전히 끝났을 때: 보드를 새로 찍고 커맨드 대기로 돌아간다.
  function settleTurn() {
    set({ turnGen: null, game: { ...get().game! } });
    const game = get().game!;
    if (game.gameOver) {
      print(renderFinish(game));
      set({ mode: 'over' });
      return;
    }
    print(renderBoard(game));
    set({ mode: 'command' });
    if (get().fastForward) {
      const t = window.setTimeout(() => get().submit(''), AUTO_DELAY_MS);
      set({ autoTimer: t });
    }
  }

  function drive(result: IteratorResult<TurnYield, void>) {
    if (result.done) {
      settleTurn();
      return;
    }

    const y = result.value;

    if (y.kind === 'strategy') {
      print([
        `📋 감독 지시 (${y.side === 'offense' ? '공격' : '수비'}): ${y.chosenLabel}`,
        ...(y.boostOnly ? ['   다음 타석에 효과가 적용됩니다.'] : []),
      ]);
      // CLI와 동일하게 별도 확인 없이 곧바로 이어서 진행한다.
      drive(get().turnGen!.next(true));
      return;
    }

    print(renderPlay(y.play, get().game!));
    if (y.play.halfEnded && !y.play.gameOver) {
      print(renderHalfTransition(y.play, get().game!));
    }
    set({ game: { ...get().game! } });

    if (y.needsChallenge && y.side) {
      const teamName = get().game!.teamNames[y.side];
      const remaining = get().game!.challenges[y.side];
      print([`[챌린지] ${teamName} - 이 판정에 도전하시겠습니까? (잔여 ${remaining}회) y/n`]);
      set({ pendingChallenge: { play: y.play, side: y.side }, mode: 'challenge' });
      return;
    }

    if (get().fastForward) {
      const t = window.setTimeout(() => drive(get().turnGen!.next(false)), AUTO_DELAY_MS);
      set({ autoTimer: t });
      return;
    }

    // 챌린지가 필요 없으면 곧바로 이어서 진행한다 (턴이 끝나거나 다음 챌린지가 나올 때까지).
    drive(get().turnGen!.next(false));
  }

  function startCommandTurn(side: 'offense' | 'defense' | null) {
    clearAutoTimer();
    const game = get().game!;
    const gen = runTurn(game, side);
    set({ turnGen: gen });
    drive(gen.next());
  }

  function handleChallengeAnswer(raw: string) {
    const answer = raw.trim().toLowerCase();
    if (answer !== 'y' && answer !== 'n') {
      print(['y 또는 n을 입력하세요.']);
      return;
    }
    print([`> ${answer}`]);
    const { turnGen, pendingChallenge, game } = get();
    set({ pendingChallenge: null });
    if (!turnGen || !pendingChallenge || !game) return;

    if (answer === 'n') {
      drive(turnGen.next(false));
      return;
    }

    const side = pendingChallenge.side;
    const result = turnGen.next(true);
    const overturned = !result.done && result.value.kind === 'play' && result.value.play.isReview;
    print([
      overturned
        ? '📺 판독 결과: 번복! (챌린지 횟수 유지)'
        : `📺 판독 결과: 원심 유지 (잔여 ${get().game!.challenges[side]}회)`,
    ]);
    drive(result);
  }

  function handleCommand(raw: string) {
    const cmd = raw.trim().toLowerCase();
    print([cmd ? `> ${cmd}` : '> (진행)']);

    if (cmd === 'q') {
      print(['경기를 중단합니다. "다시하기"로 처음부터 시작할 수 있습니다.']);
      set({ mode: 'over' });
      return;
    }
    if (cmd === '' ) {
      startCommandTurn(null);
      return;
    }
    if (cmd === 'o' || cmd === 'd') {
      const game = get().game!;
      const side = cmd === 'o' ? 'offense' : 'defense';
      const team = cmd === 'o' ? battingTeam(game) : fieldingTeam(game);
      if (game.strategyUses[team] <= 0) {
        print([`${game.teamNames[team]}은(는) 전략 사용 횟수를 모두 소진했습니다.`]);
        print(renderBoard(game));
        return;
      }
      game.strategyUses[team] -= 1;
      startCommandTurn(side);
      return;
    }
    print(['알 수 없는 명령입니다. Enter=진행, o=공격 전략, d=수비 전략, q=종료']);
    print(renderBoard(get().game!));
  }

  return {
    lines: [...WELCOME, ...renderTeamList(), '', '원정팀 번호를 입력하세요 (1-5)'],
    mode: 'pick-away',
    awayId: null,
    homeId: null,
    game: null,
    turnGen: null,
    pendingChallenge: null,
    fastForward: false,
    autoTimer: null,

    submit: (raw) => {
      const mode = get().mode;
      const cmd = raw.trim();

      if (mode === 'pick-away' || mode === 'pick-home') {
        const idx = parseInt(cmd, 10) - 1;
        print([`> ${cmd}`]);
        if (!(idx >= 0 && idx < TEAM_LIST.length)) {
          print(['올바른 번호를 입력하세요.']);
          return;
        }
        if (mode === 'pick-away') {
          set({ awayId: TEAM_LIST[idx].id });
          print(['', '홈팀을 선택하세요.', ...renderTeamList(), '', '홈팀 번호를 입력하세요 (1-5)']);
          set({ mode: 'pick-home' });
        } else {
          set({ homeId: TEAM_LIST[idx].id });
          print(['', '이닝 수를 입력하세요 (3 / 5 / 7 / 9, 그냥 Enter면 9)']);
          set({ mode: 'pick-innings' });
        }
        return;
      }

      if (mode === 'pick-innings') {
        print([`> ${cmd || '9'}`]);
        const n = cmd === '' ? 9 : parseInt(cmd, 10);
        if (![3, 5, 7, 9].includes(n)) {
          print(['3, 5, 7, 9 중 하나를 입력하세요.']);
          return;
        }
        const away = TEAM_LIST.find((t) => t.id === get().awayId)!;
        const home = TEAM_LIST.find((t) => t.id === get().homeId)!;
        const game = createGame(away, home, n);
        set({ game, mode: 'command' });
        print(['', `${away.name} (원정) vs ${home.name} (홈) — ${n}이닝 경기 시작.`,
          '명령어: Enter=진행 / o=공격 전략 / d=수비 전략 / q=종료']);
        print(renderBoard(game));
        return;
      }

      if (mode === 'command') {
        handleCommand(cmd);
        return;
      }

      if (mode === 'challenge') {
        handleChallengeAnswer(cmd);
        return;
      }

      // mode === 'over': 입력은 무시 (다시하기 버튼으로만 리셋)
    },

    toggleFastForward: () => {
      set((s) => ({ fastForward: !s.fastForward }));
      const s = get();
      if (s.fastForward && s.mode === 'command' && !s.turnGen) {
        s.submit('');
      }
    },

    restart: () => {
      clearAutoTimer();
      set({
        lines: [...WELCOME, ...renderTeamList(), '', '원정팀 번호를 입력하세요 (1-5)'],
        mode: 'pick-away',
        awayId: null,
        homeId: null,
        game: null,
        turnGen: null,
        pendingChallenge: null,
        fastForward: false,
      });
    },
  };
});
