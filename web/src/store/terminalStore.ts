import { create } from 'zustand';
import { battingTeam, createGame, fieldingTeam } from '../engine/engine';
import { runTurn, type TurnYield } from '../engine/turnController';
import type { GameState, PlayEvent, Team, TeamSide } from '../engine/types';
import { TEAM_LIST } from '../engine/teams';
import {
  COLOR, type Line, plain, renderBoard, renderFinish, renderHalfTransition,
  renderPlay, renderTeamList, seg, teamSeg,
} from '../terminal/render';

export type ControlMode = 'solo' | 'local';
export type Mode = 'pick-players' | 'pick-away' | 'pick-home' | 'pick-innings' | 'command' | 'challenge' | 'over';
type PlayYield = Extract<TurnYield, { kind: 'play' }>;

interface PendingChallenge {
  play: PlayEvent;
  side: TeamSide;
}

interface TerminalStore {
  lines: Line[];
  mode: Mode;
  controlMode: ControlMode | null;
  humanSide: TeamSide | null; // 1인용일 때만 의미 있음 (항상 원정팀 = 나)
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
const DRAW_FRAMES = 5;
const DRAW_FRAME_MS = 180;
// 1인용에서 CPU가 매 기회마다 챌린지를 걸거나 감독 전략을 지시할 확률.
const CPU_CHALLENGE_CHANCE = 0.35;
const CPU_STRATEGY_CHANCE = 0.3;

function welcomeLines(): Line[] {
  return [
    plain('⚾ 이닝롤 — 터미널 모드'),
    plain('  1. 1인용 (CPU 상대)'),
    plain('  2. 2인용 (한 화면에서 로컬 대전)'),
    [],
    plain('번호를 입력하세요 (1-2)'),
  ];
}

function teamListPrompt(introLine: string, promptLine: string): Line[] {
  return [[], plain(introLine), ...renderTeamList(), [], plain(promptLine)];
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

  // 챌린지로 뒤집힐 수 있는 판정이 아직 남아있지 않은, 확정된 결과에 대해서만
  // 이닝 전환 문구를 찍는다 (안 그러면 나중에 번복될 수도 있는 아웃을 미리 "종료"로 알리게 된다).
  function finalizePlay(play: PlayEvent) {
    if (play.halfEnded && !play.gameOver) {
      print(renderHalfTransition(play, get().game!));
    }
  }

  // 챌린지 수락/거절이 정해진 뒤의 공통 처리: 사람의 y/n 응답과 CPU의 자동 판단이 공유한다.
  function settleChallenge(play: PlayEvent, side: TeamSide, accepted: boolean) {
    const turnGen = get().turnGen!;
    if (!accepted) {
      finalizePlay(play);
      drive(turnGen.next(false));
      return;
    }
    const result = turnGen.next(true);
    const overturned = !result.done && result.value.kind === 'play' && result.value.play.isReview;
    print([[
      seg('📺 판독 결과: ', COLOR.review),
      overturned
        ? seg('번복! (챌린지 횟수 유지)', COLOR.review)
        : seg(`원심 유지 (잔여 ${get().game!.challenges[side]}회)`, COLOR.review),
    ]]);
    // 원심 유지라면 애초 판정이 그대로 확정된 것이므로 이제야 이닝 전환 문구를 찍는다.
    // (번복됐다면 새 판정이 drive(result)를 거치며 스스로 확정 여부를 처리한다.)
    if (!overturned) {
      finalizePlay(play);
    }
    drive(result);
  }

  function afterPlayPrinted(y: PlayYield) {
    set({ game: { ...get().game! } });

    if (y.needsChallenge && y.side) {
      const { controlMode, humanSide } = get();
      // 1인용에서 CPU 쪽이 도전할 판정이면, CPU 감독이 확률적으로 직접 도전 여부를 판단한다.
      if (controlMode === 'solo' && y.side !== humanSide) {
        const teamName = get().game!.teamNames[y.side];
        const willChallenge = get().game!.challenges[y.side] > 0 && Math.random() < CPU_CHALLENGE_CHANCE;
        if (willChallenge) {
          print([[seg('📺 [CPU 챌린지] ', COLOR.review), teamSeg(teamName), seg(' 감독이 이 판정에 도전합니다!')]]);
        } else {
          print([[seg('📺 CPU는 이 판정에 도전하지 않습니다.', COLOR.dim)]]);
        }
        settleChallenge(y.play, y.side, willChallenge);
        return;
      }
      const teamName = get().game!.teamNames[y.side];
      const remaining = get().game!.challenges[y.side];
      print([[
        seg('📺 [챌린지] ', COLOR.review), teamSeg(teamName),
        seg(` - 이 판정에 도전하시겠습니까? (잔여 ${remaining}회) y/n`),
      ]]);
      set({ pendingChallenge: { play: y.play, side: y.side }, mode: 'challenge' });
      return;
    }

    // 챌린지 대상이 아니었다면 이 판정이 곧 최종 결과다.
    finalizePlay(y.play);

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

    settleChallenge(pendingChallenge.play, pendingChallenge.side, answer === 'y');
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
      const { controlMode, humanSide, game } = get();
      // 1인용에서는 CPU 차례가 되면 확률적으로 CPU 감독이 스스로 전략을 지시한다.
      if (controlMode === 'solo' && game) {
        const cpuSide: 'offense' | 'defense' = battingTeam(game) !== humanSide ? 'offense' : 'defense';
        const cpuTeam = cpuSide === 'offense' ? battingTeam(game) : fieldingTeam(game);
        if (game.strategyUses[cpuTeam] > 0 && Math.random() < CPU_STRATEGY_CHANCE) {
          game.strategyUses[cpuTeam] -= 1;
          print([[seg('🤖 [CPU 전략] ', COLOR.strategy), teamSeg(game.teamNames[cpuTeam]), seg(' 감독이 지시를 내립니다.')]]);
          startCommandTurn(cpuSide);
          return;
        }
      }
      startCommandTurn(null);
      return;
    }
    if (cmd === 'o' || cmd === 'd') {
      const game = get().game!;
      const { controlMode, humanSide } = get();
      const side = cmd === 'o' ? 'offense' : 'defense';
      const team = cmd === 'o' ? battingTeam(game) : fieldingTeam(game);

      // 1인용에서는 CPU 쪽 전략을 사람이 대신 걸어줄 수 없다 (CPU 감독은 스스로 판단해서 쓴다).
      if (controlMode === 'solo' && team !== humanSide) {
        print([[seg('CPU 감독의 판단입니다 - 대신 지시할 수 없습니다.', COLOR.dim)]]);
        print(renderBoard(game));
        return;
      }
      if (game.strategyUses[team] <= 0) {
        print([[teamSeg(game.teamNames[team]), seg('은(는) 전략 사용 횟수를 모두 소진했습니다.', COLOR.danger)]]);
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

  // 실제로 경기를 만들고 시작 배너 + 첫 보드를 찍는다. 원정/홈이 이미 정해진 뒤에 호출된다.
  function beginGame(away: Team, home: Team, n: number) {
    const game = createGame(away, home, n);
    const { controlMode, humanSide } = get();
    set({ game, mode: 'command' });
    const awayTag = controlMode === 'solo' ? (humanSide === 'away' ? ' (원정, 나)' : ' (원정, CPU)') : ' (원정)';
    const homeTag = controlMode === 'solo' ? (humanSide === 'home' ? ' (홈, 나)' : ' (홈, CPU)') : ' (홈)';
    print([
      [],
      [
        teamSeg(away.name), seg(awayTag), seg(' vs '),
        teamSeg(home.name), seg(homeTag),
        seg(` — ${n}이닝 경기 시작.`),
      ],
      plain(
        controlMode === 'solo'
          ? '명령어: Enter=진행 / o 또는 d=내 팀 차례일 때 전략 / q=종료'
          : '명령어: Enter=진행 / o=공격 전략 / d=수비 전략 / q=종료',
      ),
    ]);
    print(renderBoard(game));
  }

  // 1인용 전용: 내 팀을 제외한 나머지 중에서 상대(CPU) 팀을 무작위로 뽑는다.
  function runOpponentDraw(myTeam: Team, n: number) {
    const pool = TEAM_LIST.filter((t) => t.id !== myTeam.id);
    print([[seg('🎯 상대팀(CPU)을 정하는 중...', COLOR.system)]]);
    set({ isAnimating: true });
    let frame = 0;
    const tick = () => {
      frame += 1;
      if (frame >= DRAW_FRAMES) {
        const cpuTeam = pool[Math.floor(Math.random() * pool.length)];
        replaceLastLine([seg('🎯 상대팀 확정 - '), teamSeg(cpuTeam.name)]);
        set({ isAnimating: false });
        runHomeAwayDraw(myTeam, cpuTeam, n);
        return;
      }
      const guess = pool[Math.floor(Math.random() * pool.length)];
      replaceLastLine([seg('🎯 '), teamSeg(guess.name), seg(' ...?', COLOR.dim)]);
      const t = window.setTimeout(tick, DRAW_FRAME_MS);
      set({ autoTimer: t });
    };
    const t = window.setTimeout(tick, DRAW_FRAME_MS);
    set({ autoTimer: t });
  }

  // 1인용 전용: 코인토스처럼 두 팀 이름을 번갈아 보여주다가 무작위로 원정/홈을 정한다.
  function runHomeAwayDraw(myTeam: Team, cpuTeam: Team, n: number) {
    const myIsAway = Math.random() < 0.5;
    print([[seg('🪙 선공/후공을 정하는 중...', COLOR.system)]]);
    set({ isAnimating: true });
    let frame = 0;
    const tick = () => {
      frame += 1;
      if (frame >= DRAW_FRAMES) {
        const away = myIsAway ? myTeam : cpuTeam;
        const home = myIsAway ? cpuTeam : myTeam;
        replaceLastLine([
          seg('🪙 결과 - '), teamSeg(away.name), seg(': 원정  /  '), teamSeg(home.name), seg(': 홈'),
        ]);
        set({ isAnimating: false, humanSide: myIsAway ? 'away' : 'home' });
        beginGame(away, home, n);
        return;
      }
      const guess = Math.random() < 0.5 ? myTeam : cpuTeam;
      replaceLastLine([seg('🪙 '), teamSeg(guess.name), seg(' 원정...?', COLOR.dim)]);
      const t = window.setTimeout(tick, DRAW_FRAME_MS);
      set({ autoTimer: t });
    };
    const t = window.setTimeout(tick, DRAW_FRAME_MS);
    set({ autoTimer: t });
  }

  return {
    lines: welcomeLines(),
    mode: 'pick-players',
    controlMode: null,
    humanSide: null,
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

      if (mode === 'pick-players') {
        print([echo(cmd)]);
        if (cmd !== '1' && cmd !== '2') {
          print([[seg('1 또는 2를 입력하세요.', COLOR.danger)]]);
          return;
        }
        const controlMode: ControlMode = cmd === '1' ? 'solo' : 'local';
        // 1인용은 원정/홈을 나중에 코인토스로 정하므로 아직 humanSide를 알 수 없다.
        set({ controlMode, humanSide: null, mode: 'pick-away' });
        print(teamListPrompt(
          controlMode === 'solo' ? '당신의 팀을 선택하세요.' : '원정팀을 선택하세요.',
          `번호를 입력하세요 (1-${TEAM_LIST.length})`,
        ));
        return;
      }

      if (mode === 'pick-away' || mode === 'pick-home') {
        const idx = parseInt(cmd, 10) - 1;
        print([echo(cmd)]);
        if (!(idx >= 0 && idx < TEAM_LIST.length)) {
          print([[seg('올바른 번호를 입력하세요.', COLOR.danger)]]);
          return;
        }
        const { controlMode } = get();
        if (mode === 'pick-away') {
          set({ awayId: TEAM_LIST[idx].id });
          if (controlMode === 'solo') {
            // 1인용은 상대팀(CPU)도 직접 안 고르고 나중에 랜덤으로 뽑으므로 바로 이닝 수로 넘어간다.
            set({ mode: 'pick-innings' });
            print([[], plain('이닝 수를 입력하세요 (3 / 5 / 7 / 9, 그냥 Enter면 9)')]);
          } else {
            set({ mode: 'pick-home' });
            print(teamListPrompt('홈팀을 선택하세요.', `번호를 입력하세요 (1-${TEAM_LIST.length})`));
          }
        } else {
          set({ homeId: TEAM_LIST[idx].id, mode: 'pick-innings' });
          print([[], plain('이닝 수를 입력하세요 (3 / 5 / 7 / 9, 그냥 Enter면 9)')]);
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
        const teamA = TEAM_LIST.find((t) => t.id === get().awayId)!;
        if (get().controlMode === 'solo') {
          // teamA = 내가 고른 팀 - 상대(CPU)와 원정/홈 모두 이제부터 랜덤으로 정한다.
          runOpponentDraw(teamA, n);
        } else {
          const teamB = TEAM_LIST.find((t) => t.id === get().homeId)!;
          beginGame(teamA, teamB, n);
        }
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
        mode: 'pick-players',
        controlMode: null,
        humanSide: null,
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
