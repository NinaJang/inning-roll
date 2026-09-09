import GameScreen from './components/GameScreen';
import TeamSelectScreen from './components/TeamSelectScreen';
import { useGameStore } from './store/gameStore';

export default function App() {
  const screen = useGameStore((s) => s.screen);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      {screen === 'select' ? <TeamSelectScreen /> : <GameScreen />}
    </div>
  );
}
