import type { Player, Specialty, SpecialtyCode, Team } from './types';

// 특기는 '확률 변형 규칙'으로 구현한다: 타자 특기는 자기 타석의 아웃 판정을
// 더 좋은 결과로 뒤집을 확률을, 투수 특기는 상대 타석의 좋은 결과를 다시
// 억누를 확률을 갖는다. 순서: 타자 특기(격상) -> 투수 특기(격하) -> 잡변수.
export const SPECIALTIES: Record<SpecialtyCode, Specialty> = {
  POWER: {
    kind: 'batter', label: '거포',
    desc: '아웃 판정의 10%를 홈런으로 뒤집는다',
    outUpgradeChance: 0.10, outUpgradeTo: 'HR',
  },
  CONTACT: {
    kind: 'batter', label: '교타자',
    desc: '아웃 판정의 15%를 단타로 뒤집는다',
    outUpgradeChance: 0.15, outUpgradeTo: '1B',
  },
  EYE: {
    kind: 'batter', label: '선구안',
    desc: '아웃 판정의 15%를 볼넷으로 뒤집는다',
    outUpgradeChance: 0.15, outUpgradeTo: 'BB',
  },
  SPEED: {
    kind: 'batter', label: '스피드스타',
    desc: '주자로 나가면 도루 시도 확률 +17%p, 성공률 +20%p',
    stealAttemptBonus: 0.17, stealSuccessBonus: 0.20,
  },
  ACE: {
    kind: 'pitcher', label: '에이스',
    desc: '상대의 출루성 결과 중 12%를 삼진으로 돌려세운다',
    hitDowngradeChance: 0.12, hitDowngradeTo: 'K',
  },
  GROUNDBALL: {
    kind: 'pitcher', label: '땅볼유도형',
    desc: '상대 홈런의 40%를 땅볼 아웃으로 억제한다',
    hrSuppressChance: 0.40,
  },
  WILD: {
    kind: 'pitcher', label: '제구불안',
    desc: '몸에 맞는 공 확률 +15%p, 폭투 확률 +3%p',
    extraHbpChance: 0.15, extraWildPitchChance: 0.03,
  },
};

function player(name: string, position: string, specialty?: SpecialtyCode): Player {
  return { name, position, specialty: specialty ?? null, battingOrder: null };
}

// 라인업 배열 순서대로 1~9번 타순을 매긴다. 투수는 별도(player())로 만들어 타순이 없다.
function numberLineup(lineup: Player[]): Player[] {
  return lineup.map((p, i) => ({ ...p, battingOrder: i + 1 }));
}

export const TEAMS: Record<string, Team> = {
  seoul: {
    id: 'seoul', name: '서울 코메츠', tagline: '홈런 군단',
    lineup: numberLineup([
      player('박서준', '중견수'),
      player('이현우', '유격수', 'EYE'),
      player('최민석', '1루수', 'POWER'),
      player('정태양', '지명타자', 'POWER'),
      player('강준혁', '좌익수', 'POWER'),
      player('김재원', '3루수'),
      player('윤성민', '우익수'),
      player('조현식', '포수'),
      player('임도현', '2루수'),
    ]),
    pitcher: player('한지훈', '투수', 'ACE'),
  },
  busan: {
    id: 'busan', name: '부산 웨이브', tagline: '발야구',
    lineup: numberLineup([
      player('오세훈', '중견수', 'SPEED'),
      player('배지환', '유격수', 'SPEED'),
      player('신동욱', '좌익수', 'CONTACT'),
      player('문성진', '1루수'),
      player('황인성', '지명타자'),
      player('서준영', '3루수', 'SPEED'),
      player('노태호', '우익수'),
      player('유민재', '포수'),
      player('안재현', '2루수'),
    ]),
    pitcher: player('곽태식', '투수', 'WILD'),
  },
  daejeon: {
    id: 'daejeon', name: '대전 볼케이노', tagline: '실속형 타격',
    lineup: numberLineup([
      player('백승우', '2루수', 'CONTACT'),
      player('남궁현', '유격수', 'EYE'),
      player('서인국', '1루수', 'CONTACT'),
      player('권도영', '지명타자', 'EYE'),
      player('곽민재', '좌익수'),
      player('류재현', '중견수'),
      player('표승민', '3루수'),
      player('진우석', '포수'),
      player('하동훈', '우익수'),
    ]),
    pitcher: player('마상혁', '투수', 'GROUNDBALL'),
  },
  incheon: {
    id: 'incheon', name: '인천 스콜피온스', tagline: '공격 올인',
    lineup: numberLineup([
      player('도현우', '중견수', 'SPEED'),
      player('반재승', '유격수', 'CONTACT'),
      player('설민준', '1루수', 'POWER'),
      player('편도윤', '지명타자', 'POWER'),
      player('지승현', '좌익수', 'EYE'),
      player('위성민', '3루수'),
      player('옥태영', '우익수'),
      player('감우진', '포수'),
      player('소재훈', '2루수'),
    ]),
    pitcher: player('천명호', '투수'),
  },
  daegu: {
    id: 'daegu', name: '대구 팰컨스', tagline: '빈틈없는 밸런스',
    lineup: numberLineup([
      player('나승우', '중견수', 'SPEED'),
      player('명재원', '유격수', 'CONTACT'),
      player('오택현', '1루수', 'POWER'),
      player('신유찬', '지명타자', 'EYE'),
      player('곽재민', '좌익수'),
      player('배철민', '3루수'),
      player('우진혁', '우익수'),
      player('성도경', '포수'),
      player('탁민호', '2루수'),
    ]),
    pitcher: player('여운재', '투수', 'ACE'),
  },
};

export const TEAM_LIST: Team[] = Object.values(TEAMS);
