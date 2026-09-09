'use strict';
const readline = require('readline');
const { TEAMS, SPECIALTIES } = require('./teams');
const {
  createGame, getCurrentBatter, battingTeam, fieldingTeam,
  tryChaosEvent, resolveBatterRoll, useStrategy, attemptChallenge, isReviewable, challengeSide,
} = require('./engine');

const TEAM_LIST = Object.values(TEAMS);

function parseArgs(argv) {
  const args = { sim: null, innings: 9, chaos: true, away: null, home: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sim') args.sim = parseInt(argv[++i], 10);
    else if (argv[i] === '--innings') args.innings = parseInt(argv[++i], 10);
    else if (argv[i] === '--no-chaos') args.chaos = false;
    else if (argv[i] === '--away') args.away = argv[++i];
    else if (argv[i] === '--home') args.home = argv[++i];
  }
  return args;
}

function teamById(id) {
  if (!id) return null;
  return TEAMS[id] || null;
}

function ask(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function printTeamList() {
  console.log('');
  TEAM_LIST.forEach((t, i) => {
    const specs = t.lineup.filter((p) => p.specialty).map((p) => `${p.name}(${SPECIALTIES[p.specialty].label})`).join(', ');
    const pitcherSpec = t.pitcher.specialty ? `${t.pitcher.name}(${SPECIALTIES[t.pitcher.specialty].label})` : `${t.pitcher.name}(특기 없음)`;
    console.log(`  ${i + 1}. ${t.name} — ${t.tagline}`);
    console.log(`     타자 특기: ${specs || '없음'}`);
    console.log(`     선발투수: ${pitcherSpec}`);
  });
}

async function pickTeam(rl, promptLabel) {
  console.log(`\n${promptLabel}`);
  printTeamList();
  for (;;) {
    const answer = (await ask(rl, '번호 입력 > ')).trim();
    const idx = parseInt(answer, 10) - 1;
    if (idx >= 0 && idx < TEAM_LIST.length) return TEAM_LIST[idx];
    console.log('올바른 번호를 입력하세요.');
  }
}

function halfLabel(state) {
  return `${state.inning}회 ${state.half === 'top' ? '초' : '말'}`;
}

function teamName(state, team) {
  return state.teamNames[team];
}

function renderBases(bases) {
  const mark = (r) => (r ? '●' : '○');
  return `        ${mark(bases[1])}\n     ${mark(bases[2])}   ${mark(bases[0])}\n        ⌂`;
}

function runnerSummary(bases) {
  const labels = ['1루', '2루', '3루'];
  const names = bases.map((r, i) => (r ? `${labels[i]}:${r.name}` : null)).filter(Boolean);
  return names.length ? `주자 - ${names.join(', ')}` : '주자 없음';
}

function printBoard(state) {
  const batter = getCurrentBatter(state);
  const spec = batter.specialty ? ` [${SPECIALTIES[batter.specialty].label}]` : '';
  const battingSide = battingTeam(state);
  console.log('');
  console.log(`${halfLabel(state)}  |  아웃 ${Math.min(state.outs, 3)}  |  ${state.teamNames.away} ${state.score.away} : ${state.score.home} ${state.teamNames.home}`);
  console.log(renderBases(state.bases));
  console.log(runnerSummary(state.bases));
  console.log(`타석 - ${batter.name}${spec} (${teamName(state, battingSide)})`);
  console.log(`챌린지 잔여 - ${state.teamNames.away} ${state.challenges.away} / ${state.teamNames.home} ${state.challenges.home}   전략 잔여 - ${state.teamNames.away} ${state.strategyUses.away} / ${state.teamNames.home} ${state.strategyUses.home}`);
}

function printPlay(play, state) {
  const runsTag = play.runs > 0 ? `  [+${play.runs}점]` : '';
  let line;
  if (play.isChaos) {
    line = `⚡ [${teamName(state, play.team)}] ${play.label}${runsTag}`;
  } else if (play.d1 !== undefined) {
    line = `🎲 ${play.d1}+${play.d2}=${play.sum} → ${play.label} (${play.batterName}, ${teamName(state, play.team)})${runsTag}`;
  } else {
    line = `📋 ${play.label} (${play.batterName || ''}, ${teamName(state, play.team)})${runsTag}`;
  }
  console.log(line);
  if (play.halfEnded && !play.gameOver) {
    console.log(state.half === 'bottom'
      ? '--- 공수교대: 이닝 말 시작 ---'
      : `--- 공수교대: ${state.inning}회 초 시작 ---`);
  }
}

// 플레이를 출력하고, 리뷰 가능한 판정이면 챌린지 여부를 묻는다.
// 챌린지가 성공하면 번복된 새 이벤트를 반환한다 (이닝 종료 여부는 이걸로 다시 판단해야 함).
async function resolvePlayWithChallenge(play, state, rl) {
  printPlay(play, state);
  if (isReviewable(play.code)) {
    const side = challengeSide(play);
    if (side && state.challenges[side] > 0) {
      const label = state.teamNames[side];
      const answer = (await ask(rl, `[챌린지] ${label} - 이 판정에 도전하시겠습니까? (잔여 ${state.challenges[side]}회) y/n > `)).trim().toLowerCase();
      if (answer === 'y') {
        const result = attemptChallenge(state, play);
        if (result.overturned) {
          console.log('📺 판독 결과: 번복! (챌린지 횟수 유지)');
          printPlay(result.newEvent, state);
          return result.newEvent;
        }
        state.challenges[side] -= 1;
        console.log(`📺 판독 결과: 원심 유지 (잔여 ${state.challenges[side]}회)`);
      }
    }
  }
  return play;
}

// 정상 진행(side=null) 또는 감독 전략(side='offense'|'defense')으로 한 턴을 진행한다.
async function runTurn(state, rl, chaos, side) {
  let continueToBatter = true;
  let skipChaos = false;

  if (side) {
    const result = useStrategy(state, side);
    console.log(`\n📋 감독 지시 (${side === 'offense' ? '공격' : '수비'}): ${result.chosenLabel}`);
    for (const p of result.plays) {
      const effective = await resolvePlayWithChallenge(p, state, rl);
      if (state.gameOver || effective.halfEnded) { continueToBatter = false; break; }
    }
    if (!result.continueToBatter) continueToBatter = false;
    skipChaos = result.skipChaos;
  }

  if (!continueToBatter || state.gameOver) return;

  if (chaos && !skipChaos) {
    const chaosEvent = tryChaosEvent(state);
    if (chaosEvent) {
      const effective = await resolvePlayWithChallenge(chaosEvent, state, rl);
      if (state.gameOver || effective.halfEnded) return;
    }
  }

  if (state.gameOver) return;
  const batterEvent = resolveBatterRoll(state);
  await resolvePlayWithChallenge(batterEvent, state, rl);
}

function finish(state) {
  console.log('');
  console.log('=== 경기 종료 ===');
  console.log(`최종 스코어  ${state.teamNames.away} ${state.score.away} : ${state.score.home} ${state.teamNames.home}`);
  if (state.score.away === state.score.home) console.log('무승부');
  else console.log(state.score.away > state.score.home ? `${state.teamNames.away} 승리` : `${state.teamNames.home} 승리`);
}

async function runInteractive(innings, chaos, presetAway, presetHome) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('⚾ 이닝롤 — 텍스트 프로토타입');

  const away = presetAway || await pickTeam(rl, '원정팀을 선택하세요.');
  const home = presetHome || await pickTeam(rl, '홈팀을 선택하세요.');

  const state = createGame(away, home, innings);
  console.log('');
  console.log(`${away.name} (원정) vs ${home.name} (홈) — ${innings}이닝 경기 시작.`);
  console.log('명령어: Enter=진행 / o=공격 전략 / d=수비 전략 / q=종료');
  if (chaos) console.log('⚡ 표시는 확률적으로 터지는 변수 이벤트, 📋는 감독 전략, 📺는 비디오 판독입니다.');

  while (!state.gameOver) {
    printBoard(state);
    const answer = (await ask(rl, '> ')).trim().toLowerCase();

    if (answer === 'q') {
      console.log('경기를 중단합니다.');
      rl.close();
      return;
    }

    let side = null;
    if (answer === 'o' || answer === 'd') {
      const team = answer === 'o' ? battingTeam(state) : fieldingTeam(state);
      if (state.strategyUses[team] <= 0) {
        console.log(`${state.teamNames[team]}은(는) 전략 사용 횟수를 모두 소진했습니다.`);
        continue;
      }
      state.strategyUses[team] -= 1;
      side = answer === 'o' ? 'offense' : 'defense';
    }

    await runTurn(state, rl, chaos, side);
  }

  finish(state);
  rl.close();
}

function runSimulation(count, innings, chaos, awayId, homeId) {
  const { playAtBat } = require('./engine');
  const away = teamById(awayId) || TEAM_LIST[0];
  const home = teamById(homeId) || TEAM_LIST[1];
  let totalAway = 0, totalHome = 0, winsAway = 0, winsHome = 0, totalTurns = 0;
  let hrAway = 0, hrHome = 0;

  for (let i = 0; i < count; i++) {
    const state = createGame(away, home, innings);
    let turns = 0;
    let safety = 0;
    while (!state.gameOver && safety++ < 3000) {
      const result = playAtBat(state, { chaos });
      result.plays.forEach((p) => {
        if (p.code === 'HR') {
          if (p.team === 'away') hrAway++; else hrHome++;
        }
      });
      turns++;
    }
    totalAway += state.score.away;
    totalHome += state.score.home;
    totalTurns += turns;
    if (state.score.away > state.score.home) winsAway++;
    else if (state.score.home > state.score.away) winsHome++;
  }

  console.log(`⚾ ${count}경기 시뮬레이션 (${innings}이닝) — ${away.name}(원정) vs ${home.name}(홈)`);
  console.log(`평균 득점   ${away.name} ${(totalAway / count).toFixed(2)}  |  ${home.name} ${(totalHome / count).toFixed(2)}`);
  console.log(`평균 홈런   ${away.name} ${(hrAway / count).toFixed(2)}  |  ${home.name} ${(hrHome / count).toFixed(2)}`);
  console.log(`승률        ${away.name} ${(100 * winsAway / count).toFixed(1)}%  |  ${home.name} ${(100 * winsHome / count).toFixed(1)}%`);
  console.log(`평균 진행 횟수(경기당)  ${(totalTurns / count).toFixed(1)}`);
}

const args = parseArgs(process.argv.slice(2));
if (args.sim) {
  runSimulation(args.sim, args.innings, args.chaos, args.away, args.home);
} else {
  runInteractive(args.innings, args.chaos, teamById(args.away), teamById(args.home));
}
