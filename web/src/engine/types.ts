export type TeamSide = 'away' | 'home';
export type Half = 'top' | 'bottom';

export type SpecialtyCode = 'POWER' | 'CONTACT' | 'EYE' | 'SPEED' | 'ACE' | 'GROUNDBALL' | 'WILD';

export type OutcomeCode =
  | 'DP' | '2B' | 'F' | 'G' | 'K' | '1B' | 'BB' | '3B' | 'HR'
  | 'SAC_OK' | 'SAC_FAIL';

export type ChaosCode = 'WP' | 'BK' | 'PO' | 'SB' | 'CS' | 'PO_SAFE' | 'PO_MISS';

export type PlayCode = OutcomeCode | ChaosCode;

export interface Specialty {
  kind: 'batter' | 'pitcher';
  label: string;
  desc: string;
  outUpgradeChance?: number;
  outUpgradeTo?: OutcomeCode;
  stealAttemptBonus?: number;
  stealSuccessBonus?: number;
  hitDowngradeChance?: number;
  hitDowngradeTo?: OutcomeCode;
  hrSuppressChance?: number;
  extraHbpChance?: number;
  extraWildPitchChance?: number;
}

export interface Player {
  name: string;
  position: string;
  specialty: SpecialtyCode | null;
  // 타순(1~9). 투수는 타석에 서지 않으므로 null.
  battingOrder: number | null;
}

export interface Team {
  id: string;
  name: string;
  tagline: string;
  lineup: Player[];
  pitcher: Player;
}

export type Bases = [Player | null, Player | null, Player | null];

export interface PendingModifier {
  kind: 'upgrade' | 'downgrade';
  chance: number;
  to: OutcomeCode;
  onlyContact?: boolean;
  feat: string;
}

export interface StateSnapshot {
  inning: number;
  half: Half;
  outs: number;
  bases: Bases;
  score: { away: number; home: number };
  gameOver: boolean;
  battingIndex: { away: number; home: number };
}

export interface GameState {
  maxInnings: number;
  inning: number;
  half: Half;
  outs: number;
  bases: Bases;
  score: { away: number; home: number };
  gameOver: boolean;
  lineups: { away: Player[]; home: Player[] };
  battingIndex: { away: number; home: number };
  pitchers: { away: Player; home: Player };
  teamNames: { away: string; home: string };
  challenges: { away: number; home: number };
  strategyUses: { away: number; home: number };
  pendingModifier: PendingModifier | null;
}

export interface PlayEventMeta {
  runner?: Player;
  fromIdx?: number;
  idx?: number;
  batter?: Player;
}

export interface PlayEvent {
  inning: number;
  half: Half;
  team: TeamSide;
  outsAfter: number;
  basesAfter: Bases;
  halfEnded: boolean;
  gameOver: boolean;
  walkoff?: boolean;
  runs: number;
  isChaos: boolean;
  isStrategy: boolean;
  isReview: boolean;
  code: PlayCode;
  label: string;
  d1?: number;
  d2?: number;
  sum?: number;
  batterName?: string;
  pitchCount?: { balls: number; strikes: number };
  snapshot?: StateSnapshot;
  meta?: PlayEventMeta;
}

export interface StrategyResult {
  chosenKey: string;
  chosenLabel: string;
  plays: PlayEvent[];
  continueToBatter: boolean;
  skipChaos: boolean;
}
