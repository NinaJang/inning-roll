import { useEffect, useRef, useState } from 'react';
import { TEAM_LIST } from '../engine/teams';
import { useTerminalStore } from '../store/terminalStore';

function QuickButton({ label, onClick, disabled, tone = 'default' }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'accent' | 'warn';
}) {
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
          {lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {line.length === 0
                ? ' '
                : line.map((s, j) => <span key={j} className={s.cls}>{s.text}</span>)}
            </div>
          ))}
          <span className="inline-block w-2 h-4 bg-neutral-300 align-text-bottom ml-1 animate-pulse" />
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
          {mode === 'command' && game && (
            <>
              <QuickButton label="Enter (진행)" tone="accent" onClick={() => send('')} disabled={isAnimating} />
              {showOffenseBtn && (
                <QuickButton
                  label={`o 공격 전략 (${offenseTeam ? game.strategyUses[offenseTeam] : 0})`}
                  onClick={() => send('o')}
                  disabled={isAnimating || !offenseTeam || game.strategyUses[offenseTeam] <= 0}
                />
              )}
              {showDefenseBtn && (
                <QuickButton
                  label={`d 수비 전략 (${defenseTeam ? game.strategyUses[defenseTeam] : 0})`}
                  onClick={() => send('d')}
                  disabled={isAnimating || !defenseTeam || game.strategyUses[defenseTeam] <= 0}
                />
              )}
              <QuickButton label="q (종료)" tone="warn" onClick={() => send('q')} disabled={isAnimating} />
            </>
          )}
          {mode === 'challenge' && (
            <>
              <QuickButton label="y (도전한다)" tone="accent" onClick={() => send('y')} disabled={isAnimating} />
              <QuickButton label="n (그냥 진행)" onClick={() => send('n')} disabled={isAnimating} />
            </>
          )}
          {mode === 'pick-players' && (
            <>
              <QuickButton label="1 (1인용)" tone="accent" onClick={() => send('1')} />
              <QuickButton label="2 (2인용)" onClick={() => send('2')} />
            </>
          )}
          {(mode === 'pick-away' || mode === 'pick-home') && (
            <>
              {TEAM_LIST.map((_, i) => (
                <QuickButton key={i} label={String(i + 1)} onClick={() => send(String(i + 1))} />
              ))}
            </>
          )}
          {mode === 'pick-innings' && !isAnimating && (
            <>
              {[3, 5, 7, 9].map((n) => (
                <QuickButton key={n} label={String(n)} onClick={() => send(String(n))} />
              ))}
            </>
          )}
          {mode === 'over' && (
            <QuickButton label="다시하기" tone="accent" onClick={restart} />
          )}
        </div>
      </div>
    </div>
  );
}
