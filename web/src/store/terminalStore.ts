import { create } from 'zustand';
import { battingTeam, createGame, fieldingTeam } from '../engine/engine';
import { runTurn, type TurnYield } from '../engine/turnController';
import type { GameState, PlayEvent, TeamSide } from '../engine/types';
import { TEAM_LIST } from '../engine/teams';
import {
  COLOR, type Line, plain, renderBoard, renderFinish, renderHalfTransition,
  renderPlay, renderTeamList, seg, teamSeg,
} from '../terminal/render';

export type Mode = 'pick-away' | 'pick-home' | 'pick-innings' | 'command' | 'challenge' | 'over';
type PlayYield = Extract<TurnYield, { kind: 'play' }>;

interface PendingChallenge {
  play: PlayEvent;
  side: TeamSide;
}

interface TerminalStore {
  lines: Line[];
  mode: Mode;
  awayId: string | null;
  homeId: string | null;
  game: GameState | null;
  turnGen: Generator<TurnYield, void, boolean> | null;
  pendingChallenge: PendingChallenge | null;
  fastForward: boolean;
  isAnimating: boolean;
  autoTimer: number | null;

  submit: (raw: string) => void;
  toggleFastForward: () => void;
  restart: () => void;
}

const AUTO_DELAY_MS = 500;
const ROLL_FRAMES = 4;
const ROLL_FRAME_MS = 160;
const BAR_LEN = 5;

function welcomeLines(): Line[] {
  return [
    plain('⚾ 이닝롤 — 터미널 모드'),
    plain('팀을 골라 경기를 시작합니다.'),
    ...renderTeamList(),
    [],
    plain('원정팀 번호를 입력하세요 (1-5)'),
  ];
}

function echo(cmd: string): Line {
  return [seg(cmd ? `> ${cmd}` : '> (진행)', COLOR.dim)];
}

function rollingFrame(frame: number): Line {
  const filled = Math.min(BAR_LEN, Math.round(((frame + 1) / ROLL_FRAMES) * BAR_LEN));
  const bar = '▰'.repeat(filled) + '▱'.repeat(BAR_LEN - filled);
  const n1 = 1 + Math.floor(Math.random() * 6);
  const n2 = 1 + Math.floor(Math.random() * 6);
  return [seg('🎲 '), seg(`[${bar}] `, COLOR.dim), seg(`[${n1}] [${n2}]  굴리는 중...`, COLOR.dim)];
}

export const useTerminalStore = create<TerminalStore>((set, get) => {
  function print(newLines: Line[]) {
    set((s) => ({ lines: [...s.lines, ...newLines] }));
  }

  function replaceLastLine(line: Line) {
    set((s) => ({ lines: [...s.lines.slice(0, -1), line] }));
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

  // 타석 굴림(2d6)에 진행바+주사위 이모지 사이클링 연출을 입힌 뒤 실제 결과로 교체한다.
  // 빨리감기 중에는 속도가 생명이므로 애니메이션 없이 바로 결과를 보여준다.
  function animateDiceRoll(y: PlayYield) {
    set({ isAnimating: true });
    print([rollingFrame(0)]);
    let frame = 0;
    const tick = () => {
      frame += 1;
      if (frame >= ROLL_FRAMES) {
        replaceLastLine(renderPlay(y.play, get().game!)[0]);
        set({ isAnimating: false });
        afterPlayPrinted(y);
        return;
      }
      replaceLastLine(rollingFrame(frame));
      const t = window.setTimeout(tick, ROLL_FRAME_MS);
      set({ autoTimer: t });
    };
    const t = window.setTimeout(tick, ROLL_FRAME_MS);
    set({ autoTimer: t });
  }

  function afterPlayPrinted(y: PlayYield) {
    if (y.play.halfEnded && !y.play.gameOver) {
      print(renderHalfTransition(y.play, get().game!));
    }
    set({ game: { ...get().game! } });

    if (y.needsChallenge && y.side) {
      const teamName = get().game!.teamNames[y.side];
      const remaining = get().game!.challenges[y.side];
      print([[
        seg('📺 [챌린지] ', COLOR.review), teamSeg(teamName, y.side),
        seg(` - 이 판정에 도전하시겠습니까? (잔여 ${remaining}회) y/n`),
      ]]);
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

  function drive(result: IteratorResult<TurnYield, void>) {
    if (result.done) {
      settleTurn();
      return;
    }

    const y = result.value;

    if (y.kind === 'strategy') {
      print([
        [seg(`📋 감독 지시 (${y.side === 'offense' ? '공격' : '수비'}): `), seg(y.chosenLabel, COLOR.strategy)],
        ...(y.boostOnly ? [[seg('   다음 타석에 효과가 적용됩니다.', COLOR.dim)] as Line] : []),
      ]);
      // CLI와 동일하게 별도 확인 없이 곧바로 이어서 진행한다.
      drive(get().turnGen!.next(true));
      return;
    }

    const isDiceRoll = y.play.d1 !== undefined;
    if (isDiceRoll && !get().fastForward) {
      animateDiceRoll(y);
      return;
    }

    print(renderPlay(y.play, get().game!));
    afterPlayPrinted(y);
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
      print([[seg('y 또는 n을 입력하세요.', COLOR.danger)]]);
      return;
    }
    print([echo(answer)]);
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
    print([[
      seg('📺 판독 결과: ', COLOR.review),
      overturned
        ? seg('번복! (챌린지 횟수 유지)', COLOR.review)
        : seg(`원심 유지 (잔여 ${get().game!.challenges[side]}회)`, COLOR.review),
    ]]);
    drive(result);
  }

  function handleCommand(raw: string) {
    const cmd = raw.trim().toLowerCase();
    print([echo(cmd)]);

    if (cmd === 'q') {
      print([[seg('경기를 중단합니다. "다시하기"로 처음부터 시작할 수 있습니다.', COLOR.system)]]);
      set({ mode: 'over' });
      return;
    }
    if (cmd === '') {
      startCommandTurn(null);
      return;
    }
    if (cmd === 'o' || cmd === 'd') {
      const game = get().game!;
      const side = cmd === 'o' ? 'offense' : 'defense';
      const team = cmd === 'o' ? battingTeam(game) : fieldingTeam(game);
      if (game.strategyUses[team] <= 0) {
        print([[teamSeg(game.teamNames[team], team), seg('은(는) 전략 사용 횟수를 모두 소진했습니다.', COLOR.danger)]]);
        print(renderBoard(game));
        return;
      }
      game.strategyUses[team] -= 1;
      startCommandTurn(side);
      return;
    }
    print([[seg('알 수 없는 명령입니다. Enter=진행, o=공격 전략, d=수비 전략, q=종료', COLOR.danger)]]);
    print(renderBoard(get().game!));
  }

  return {
    lines: welcomeLines(),
    mode: 'pick-away',
    awayId: null,
    homeId: null,
    game: null,
    turnGen: null,
    pendingChallenge: null,
    fastForward: false,
    isAnimating: false,
    autoTimer: null,

    submit: (raw) => {
      if (get().isAnimating) return;
      const mode = get().mode;
      const cmd = raw.trim();

      if (mode === 'pick-away' || mode === 'pick-home') {
        const idx = parseInt(cmd, 10) - 1;
        print([echo(cmd)]);
        if (!(idx >= 0 && idx < TEAM_LIST.length)) {
          print([[seg('올바른 번호를 입력하세요.', COLOR.danger)]]);
          return;
        }
        if (mode === 'pick-away') {
          set({ awayId: TEAM_LIST[idx].id });
          print([[], plain('홈팀을 선택하세요.'), ...renderTeamList(), [], plain('홈팀 번호를 입력하세요 (1-5)')]);
          set({ mode: 'pick-home' });
        } else {
          set({ homeId: TEAM_LIST[idx].id });
          print([[], plain('이닝 수를 입력하세요 (3 / 5 / 7 / 9, 그냥 Enter면 9)')]);
          set({ mode: 'pick-innings' });
        }
        return;
      }

      if (mode === 'pick-innings') {
        print([echo(cmd || '9')]);
        const n = cmd === '' ? 9 : parseInt(cmd, 10);
        if (![3, 5, 7, 9].includes(n)) {
          print([[seg('3, 5, 7, 9 중 하나를 입력하세요.', COLOR.danger)]]);
          return;
        }
        const away = TEAM_LIST.find((t) => t.id === get().awayId)!;
        const home = TEAM_LIST.find((t) => t.id === get().homeId)!;
        const game = createGame(away, home, n);
        set({ game, mode: 'command' });
        print([
          [],
          [teamSeg(away.name, 'away'), seg(' (원정) vs '), teamSeg(home.name, 'home'), seg(` (홈) — ${n}이닝 경기 시작.`)],
          plain('명령어: Enter=진행 / o=공격 전략 / d=수비 전략 / q=종료'),
        ]);
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
      if (s.fastForward && s.mode === 'command' && !s.turnGen && !s.isAnimating) {
        s.submit('');
      }
    },

    restart: () => {
      clearAutoTimer();
      set({
        lines: welcomeLines(),
        mode: 'pick-away',
        awayId: null,
        homeId: null,
        game: null,
        turnGen: null,
        pendingChallenge: null,
        fastForward: false,
        isAnimating: false,
      });
    },
  };
});
