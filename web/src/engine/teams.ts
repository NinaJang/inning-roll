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

// 실제 KBO 10개 구단의 연고지와 구단 색을 그대로 가져오되, 팀명은 그대로 쓰지 않고
// 각 구단의 마스코트/정체성과 연결되는 다른 단어로 새로 지었다.
// (그리즐리/랩터스/타이탄스/재규어스/호크스처럼 흔히 쓰이는 마스코트 단어는
//  다른 서비스와 겹치기 쉬워서 피하고, 덜 흔한 단어로 다시 골랐다.)
//  두산 베어스(서울,네이비 곰)      -> 서울 코디악스 (곰의 한 종류지만 덜 흔한 이름)
//  LG 트윈스(서울,핑크 쌍둥이)      -> 서울 미러스 (거울 = 쌍둥이처럼 비치는 상)
//  키움 히어로즈(서울,버건디 영웅)   -> 서울 센티널스 (영웅 대신 파수꾼)
//  SSG 랜더스(인천,레드 우주)       -> 인천 노바스 (우주선 대신 초신성)
//  NC 다이노스(창원,스카이블루 공룡) -> 창원 스테고스 (공룡이지만 특정 종 이름)
//  삼성 라이온즈(대구,블루 사자)     -> 대구 스핑크스 (사자 몸을 한 신화 속 존재)
//  롯데 자이언츠(부산,퍼플 거인)     -> 부산 콜로서스 (거인 대신 거대 석상)
//  KIA 타이거즈(광주,앰버 호랑이)    -> 광주 백호 (호랑이의 한국 신화 속 이름, 사신 중 하나)
//  한화 이글스(대전,오렌지 독수리)   -> 대전 그리폰 (독수리+사자 모습의 신화 속 존재)
//  KT 위즈(수원,라임 마법사)        -> 수원 룬즈 (마법사 대신 마법의 룬 문자)
export const TEAMS: Record<string, Team> = {
  seoulKodiaks: {
    id: 'seoulKodiaks', name: '서울 코디악스', tagline: '노련한 근성', color: 'text-blue-400',
    lineup: numberLineup([
      player('문시우', '중견수', 'CONTACT'),
      player('강도윤', '유격수', 'EYE'),
      player('조민석', '1루수', 'POWER'),
      player('임재현', '지명타자'),
      player('한상우', '좌익수'),
      player('오태윤', '3루수'),
      player('배현준', '우익수'),
      player('윤성재', '포수'),
      player('장도훈', '2루수'),
    ]),
    pitcher: player('최상훈', '투수', 'GROUNDBALL'),
  },
  seoulMirrors: {
    id: 'seoulMirrors', name: '서울 미러스', tagline: '쌍둥이 화력', color: 'text-fuchsia-400',
    lineup: numberLineup([
      player('김도현', '중견수', 'SPEED'),
      player('이준혁', '유격수'),
      player('박태양', '1루수', 'POWER'),
      player('최현우', '지명타자', 'POWER'),
      player('정민재', '좌익수'),
      player('강준서', '3루수'),
      player('조현석', '우익수'),
      player('윤재민', '포수'),
      player('임성진', '2루수'),
    ]),
    pitcher: player('한지호', '투수', 'ACE'),
  },
  seoulSentinels: {
    id: 'seoulSentinels', name: '서울 센티널스', tagline: '언더독의 반란', color: 'text-rose-400',
    lineup: numberLineup([
      player('오승우', '중견수', 'SPEED'),
      player('서재윤', '유격수', 'CONTACT'),
      player('신동현', '1루수'),
      player('황민준', '지명타자', 'EYE'),
      player('안태민', '좌익수'),
      player('송재현', '3루수'),
      player('전규민', '우익수'),
      player('홍성훈', '포수'),
      player('유진우', '2루수'),
    ]),
    pitcher: player('고영훈', '투수'),
  },
  incheonNovas: {
    id: 'incheonNovas', name: '인천 노바스', tagline: '화끈한 물량공세', color: 'text-red-400',
    lineup: numberLineup([
      player('문준우', '중견수'),
      player('양시윤', '유격수'),
      player('손태호', '1루수', 'POWER'),
      player('배규현', '지명타자', 'POWER'),
      player('백도영', '좌익수', 'POWER'),
      player('허재훈', '3루수'),
      player('남기웅', '우익수'),
      player('심우진', '포수'),
      player('노찬영', '2루수'),
    ]),
    pitcher: player('하동민', '투수', 'ACE'),
  },
  changwonStegos: {
    id: 'changwonStegos', name: '창원 스테고스', tagline: '빈틈없는 조직력', color: 'text-sky-400',
    lineup: numberLineup([
      player('곽지안', '중견수', 'SPEED'),
      player('성민호', '유격수', 'CONTACT'),
      player('차현민', '1루수'),
      player('주병준', '지명타자'),
      player('우태양', '좌익수'),
      player('구찬우', '3루수', 'SPEED'),
      player('나승현', '우익수'),
      player('민재영', '포수'),
      player('진규성', '2루수'),
    ]),
    pitcher: player('지상혁', '투수', 'GROUNDBALL'),
  },
  daeguSphinx: {
    id: 'daeguSphinx', name: '대구 스핑크스', tagline: '왕조의 자존심', color: 'text-indigo-400',
    lineup: numberLineup([
      player('엄도훈', '중견수'),
      player('채영민', '유격수', 'EYE'),
      player('원태준', '1루수', 'POWER'),
      player('천민성', '지명타자', 'EYE'),
      player('방현우', '좌익수'),
      player('공재승', '3루수'),
      player('현우진', '우익수'),
      player('함성우', '포수'),
      player('변도현', '2루수'),
    ]),
    pitcher: player('염태웅', '투수', 'ACE'),
  },
  busanColossus: {
    id: 'busanColossus', name: '부산 콜로서스', tagline: '거인의 심장', color: 'text-purple-400',
    lineup: numberLineup([
      player('여준혁', '중견수', 'CONTACT'),
      player('추상준', '유격수'),
      player('도민규', '1루수', 'POWER'),
      player('소재영', '지명타자', 'POWER'),
      player('마현준', '좌익수'),
      player('편도훈', '3루수'),
      player('위성진', '우익수'),
      player('옥준서', '포수'),
      player('감태현', '2루수'),
    ]),
    pitcher: player('표승진', '투수', 'WILD'),
  },
  gwangjuBaekho: {
    id: 'gwangjuBaekho', name: '광주 백호', tagline: '우승 DNA', color: 'text-amber-400',
    lineup: numberLineup([
      player('탁민준', '중견수', 'SPEED'),
      player('남궁태윤', '유격수', 'CONTACT'),
      player('김현성', '1루수', 'POWER'),
      player('이도준', '지명타자'),
      player('박준영', '좌익수'),
      player('최시훈', '3루수'),
      player('정재우', '우익수'),
      player('강민혁', '포수'),
      player('조성민', '2루수'),
    ]),
    pitcher: player('윤도영', '투수', 'ACE'),
  },
  daejeonGriffon: {
    id: 'daejeonGriffon', name: '대전 그리폰', tagline: '예측불허 매직', color: 'text-orange-400',
    lineup: numberLineup([
      player('임현수', '중견수', 'SPEED'),
      player('한상윤', '유격수', 'EYE'),
      player('오재원', '1루수'),
      player('서동준', '지명타자'),
      player('신태양', '좌익수'),
      player('권민서', '3루수', 'SPEED'),
      player('황준혁', '우익수'),
      player('안도현', '포수'),
      player('송재우', '2루수'),
    ]),
    pitcher: player('유민혁', '투수', 'WILD'),
  },
  suwonRunes: {
    id: 'suwonRunes', name: '수원 룬즈', tagline: '신생팀의 마법', color: 'text-lime-400',
    lineup: numberLineup([
      player('고태민', '중견수', 'CONTACT'),
      player('문준혁', '유격수'),
      player('양재현', '1루수'),
      player('손도윤', '지명타자', 'POWER'),
      player('배성민', '좌익수', 'EYE'),
      player('허준영', '3루수'),
      player('남태훈', '우익수'),
      player('심재준', '포수'),
      player('노현우', '2루수'),
    ]),
    pitcher: player('백승효', '투수'),
  },
};

export const TEAM_LIST: Team[] = Object.values(TEAMS);
