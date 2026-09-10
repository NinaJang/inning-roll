import { useEffect, useRef, useState } from 'react';
import { TEAM_LIST } from '../engine/teams';
import { useTerminalStore } from '../store/terminalStore';

function QuickButton({ label, onClick, disabled, tone = 'default', pill = false }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'accent' | 'warn';
  pill?: boolean;
}) {
  if (pill) {
    // 알림창(Electron) 모드 - 터미널 박스 대신, 윈도우 알림 액션 버튼처럼 둥글고 작게.
    const toneClass = tone === 'accent'
      ? 'bg-blue-600 text-white hover:bg-blue-500'
      : tone === 'warn'
        ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30'
        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600';
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`px-2 py-1 rounded-full text-[10px] font-medium leading-none ${toneClass} disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        {label}
      </button>
    );
  }
  const toneClass = tone === 'accent'
    ? 'border-emerald-500 text-emerald-400 hover:bg-emerald-500/10'
    : tone === 'warn'
      ? 'border-red-500 text-red-400 hover:bg-red-500/10'
      : 'border-neutral-600 text-neutral-300 hover:bg-neutral-700/50';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded border text-xs font-mono ${toneClass} disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  );
}

export default function TerminalScreen() {
  const lines = useTerminalStore((s) => s.lines);
  const mode = useTerminalStore((s) => s.mode);
  const controlMode = useTerminalStore((s) => s.controlMode);
  const humanSide = useTerminalStore((s) => s.humanSide);
  const game = useTerminalStore((s) => s.game);
  const fastForward = useTerminalStore((s) => s.fastForward);
  const isAnimating = useTerminalStore((s) => s.isAnimating);
  const submit = useTerminalStore((s) => s.submit);
  const toggleFastForward = useTerminalStore((s) => s.toggleFastForward);
  const restart = useTerminalStore((s) => s.restart);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 터치(모바일) 기기에서는 입력창에 포커스가 갈 때마다 가상 키보드가 튀어나와 화면을
  // 가리고 조작을 방해한다. 버튼만으로도 전부 조작 가능하니, 이런 기기에서는 자동
  // 포커스를 아예 주지 않는다 (직접 탭하면 그때는 정상적으로 키보드가 뜬다).
  const [isCoarsePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  // 버튼 클릭이나 애니메이션(입력창 임시 비활성화) 때문에 포커스가 빠지면
  // 매번 다시 클릭해야 Enter가 먹는 문제가 있었다 - 상태가 바뀔 때마다 자동으로 되돌려준다.
  useEffect(() => {
    if (mode !== 'over' && !isAnimating && !isCoarsePointer) {
      inputRef.current?.focus();
    }
  }, [mode, isAnimating, lines.length, isCoarsePointer]);

  function send(value: string) {
    submit(value);
    setInput('');
    if (!isCoarsePointer) inputRef.current?.focus();
  }

  const promptLabel = mode === 'pick-players' ? '모드 #'
    : mode === 'pick-away' ? '원정팀 #'
    : mode === 'pick-home' ? '홈팀 #'
    : mode === 'pick-innings' ? '이닝 수'
    : mode === 'challenge' ? 'y/n'
    : mode === 'over' ? '(경기 종료)'
    : '>';

  const offenseTeam = game ? (game.half === 'top' ? 'away' : 'home') : null;
  const defenseTeam = game ? (game.half === 'top' ? 'home' : 'away') : null;
  // 1인용에서는 CPU 쪽 전략 버튼은 아예 숨긴다 (CPU는 전략을 쓰지 않으므로).
  const showOffenseBtn = controlMode !== 'solo' || offenseTeam === humanSide;
  const showDefenseBtn = controlMode !== 'solo' || defenseTeam === humanSide;

  // Electron 알림창 셸 안에서 열렸으면, 브라우저 탭 안에서 가운데 떠 있는 카드가 아니라
  // 작은 창 전체를 꽉 채우는, 입력창 없는 버튼 전용 레이아웃으로 바뀐다.
  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

  // 두 레이아웃(웹 / Electron 알림창)이 공유하는 버튼 목록 - pill이면 알림 액션 버튼 스타일.
  function renderButtons(pill: boolean) {
    return (
      <>
        {mode === 'command' && game && (
          <>
            <QuickButton pill={pill} label="Enter (진행)" tone="accent" onClick={() => send('')} disabled={isAnimating} />
            {showOffenseBtn && (
              <QuickButton
                pill={pill}
                label={`o 공격 전략 (${offenseTeam ? `${game.teamNames[offenseTeam]} ${game.strategyUses[offenseTeam]}` : 0})`}
                onClick={() => send('o')}
                disabled={isAnimating || !offenseTeam || game.strategyUses[offenseTeam] <= 0}
              />
            )}
            {showDefenseBtn && (
              <QuickButton
                pill={pill}
                label={`d 수비 전략 (${defenseTeam ? `${game.teamNames[defenseTeam]} ${game.strategyUses[defenseTeam]}` : 0})`}
                onClick={() => send('d')}
                disabled={isAnimating || !defenseTeam || game.strategyUses[defenseTeam] <= 0}
              />
            )}
            <QuickButton pill={pill} label="q (종료)" tone="warn" onClick={() => send('q')} disabled={isAnimating} />
          </>
        )}
        {mode === 'challenge' && (
          <>
            <QuickButton pill={pill} label="y (도전한다)" tone="accent" onClick={() => send('y')} disabled={isAnimating} />
            <QuickButton pill={pill} label="n (그냥 진행)" onClick={() => send('n')} disabled={isAnimating} />
          </>
        )}
        {mode === 'pick-players' && (
          <>
            <QuickButton pill={pill} label="1 (1인용)" tone="accent" onClick={() => send('1')} />
            <QuickButton pill={pill} label="2 (2인용)" onClick={() => send('2')} />
          </>
        )}
        {(mode === 'pick-away' || mode === 'pick-home') && (
          <>
            {TEAM_LIST.map((_, i) => (
              <QuickButton pill={pill} key={i} label={String(i + 1)} onClick={() => send(String(i + 1))} />
            ))}
          </>
        )}
        {mode === 'pick-innings' && !isAnimating && (
          <>
            {[3, 5, 7, 9].map((n) => (
              <QuickButton pill={pill} key={n} label={String(n)} onClick={() => send(String(n))} />
            ))}
          </>
        )}
        {mode === 'over' && (
          <QuickButton pill={pill} label="다시하기" tone="accent" onClick={restart} />
        )}
      </>
    );
  }

  function renderLines() {
    return (
      <>
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap">
            {line.length === 0
              ? ' '
              : line.map((s, j) => <span key={j} className={s.cls}>{s.text}</span>)}
          </div>
        ))}
        <span className="inline-block w-2 h-4 bg-neutral-300 align-text-bottom ml-1 animate-pulse" />
      </>
    );
  }

  if (isElectron) {
    return (
      <div className="h-screen w-screen bg-transparent flex items-center justify-center p-1">
        <div
          className="h-full w-full flex flex-col rounded-xl overflow-hidden shadow-2xl"
          style={{ fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif" }}
        >
          {/* 알림 헤더 - 윈도우 시스템 테마(라이트/다크)를 따라간다 */}
          <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-white text-neutral-900 border-b border-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700">
            <span className="text-sm">⚾</span>
            <span className="text-[11px] font-semibold flex-1 truncate">이닝롤</span>
            <label className="flex items-center gap-1 text-[10px] text-neutral-400 cursor-pointer select-none">
              ff
              <input type="checkbox" checked={fastForward} onChange={toggleFastForward} className="w-3 h-3 accent-blue-500" />
            </label>
            <button
              onClick={() => window.close()}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-sm leading-none px-1"
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          {/* 스크롤백 - 색 코딩이 어두운 배경 기준으로 맞춰져 있어 여기는 테마와 무관하게 유지 */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 text-[10px] leading-snug bg-neutral-950 text-neutral-200">
            {renderLines()}
          </div>

          {/* 버튼만 (입력창 없음) - 윈도우 알림 액션 버튼처럼 */}
          <div className="shrink-0 flex flex-wrap gap-1 px-2 py-1.5 bg-white border-t border-neutral-200 dark:bg-neutral-900 dark:border-neutral-700">
            {renderButtons(true)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-3">
      <div
        className="w-full max-w-2xl rounded-lg overflow-hidden shadow-2xl border border-neutral-800"
        style={{ fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace" }}
      >
        {/* 타이틀바 */}
        <div className="bg-neutral-800 px-3 py-1.5 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="ml-2 text-neutral-400 text-xs">inning-roll — bash</span>
          <a
            href="https://claude.ai/code/artifact/94e4f1e9-be3b-4153-a59b-a92a98430571"
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs text-neutral-400 hover:text-emerald-400 underline decoration-dotted"
          >
            ❓ 룰북
          </a>
          <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer select-none">
            ⚡ff
            <input type="checkbox" checked={fastForward} onChange={toggleFastForward} className="w-3.5 h-3.5 accent-emerald-500" />
          </label>
        </div>

        {/* 스크롤백 */}
        <div ref={scrollRef} className="bg-neutral-950 text-neutral-200 text-sm p-3 h-[60vh] overflow-y-auto leading-relaxed">
          {renderLines()}
        </div>

        {/* 입력줄 */}
        <div className="bg-neutral-950 border-t border-neutral-800 px-3 py-2 flex items-center gap-2">
          <span className="text-cyan-400 text-sm shrink-0">{promptLabel} $</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
            disabled={mode === 'over' || isAnimating}
            className="flex-1 bg-transparent text-neutral-100 text-sm outline-none disabled:opacity-40"
            autoFocus={!isCoarsePointer}
            spellCheck={false}
          />
        </div>

        {/* 단축 버튼 */}
        <div className="bg-neutral-900 px-3 py-2 flex flex-wrap gap-2">
          {renderButtons(false)}
        </div>
      </div>
    </div>
  );
}
