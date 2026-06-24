export type CharacterId =
  | 'bartCassidy'
  | 'blackJack'
  | 'calamityJanet'
  | 'elGringo'
  | 'jesseJones'
  | 'jourdonnais'
  | 'kitCarlson'
  | 'luckyDuke'
  | 'paulRegret'
  | 'pedroRamirez'
  | 'roseDoolan'
  | 'sidKetchum'
  | 'slabTheKiller'
  | 'suzyLafayette'
  | 'vultureSam'
  | 'willyTheKid';

export interface CharacterDef {
  id: CharacterId;
  name: string;        // 한국어 이름
  baseHealth: number;  // 기본 체력 (보안관은 +1)
  ability: string;     // 한국어 능력 설명
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  bartCassidy: {
    id: 'bartCassidy', name: '바트 캐시디', baseHealth: 4,
    ability: '체력을 잃을 때마다, 잃은 체력 1당 카드 1장을 뽑는다.',
  },
  blackJack: {
    id: 'blackJack', name: '블랙 잭', baseHealth: 4,
    ability: '뽑기 단계에서 두 번째 카드를 공개한다. 하트나 다이아면 카드 1장을 더 뽑는다.',
  },
  calamityJanet: {
    id: 'calamityJanet', name: '칼라미티 자넷', baseHealth: 4,
    ability: '뱅!을 빗나감!처럼, 빗나감!을 뱅!처럼 사용할 수 있다.',
  },
  elGringo: {
    id: 'elGringo', name: '엘 그링고', baseHealth: 3,
    ability: '다른 플레이어 때문에 체력을 잃으면, 그 플레이어의 손패에서 카드 1장을 가져온다.',
  },
  jesseJones: {
    id: 'jesseJones', name: '제시 존스', baseHealth: 4,
    ability: '뽑기 단계의 첫 카드를 덱 대신 다른 플레이어의 손패에서 뽑을 수 있다.',
  },
  jourdonnais: {
    id: 'jourdonnais', name: '조르도네', baseHealth: 4,
    ability: '나무통을 가진 것과 같다. 뱅!을 맞을 때 뽑기로 하트가 나오면 빗나간다.',
  },
  kitCarlson: {
    id: 'kitCarlson', name: '킷 칼슨', baseHealth: 4,
    ability: '뽑기 단계에 덱 위 3장을 보고 2장을 가져간다. 나머지 1장은 덱 위로 되돌린다.',
  },
  luckyDuke: {
    id: 'luckyDuke', name: '럭키 듀크', baseHealth: 4,
    ability: '"뽑기!"를 할 때 2장을 뽑아 더 유리한 쪽을 선택한다.',
  },
  paulRegret: {
    id: 'paulRegret', name: '폴 리그렛', baseHealth: 3,
    ability: '머스탱을 가진 것과 같다. 다른 사람이 보는 나와의 거리가 1 늘어난다.',
  },
  pedroRamirez: {
    id: 'pedroRamirez', name: '페드로 라미레즈', baseHealth: 4,
    ability: '뽑기 단계의 첫 카드를 버린 더미 맨 위에서 가져올 수 있다.',
  },
  roseDoolan: {
    id: 'roseDoolan', name: '로즈 둘란', baseHealth: 4,
    ability: '조준경을 가진 것과 같다. 다른 사람과의 거리가 1 줄어든다.',
  },
  sidKetchum: {
    id: 'sidKetchum', name: '시드 케첨', baseHealth: 4,
    ability: '언제든지 손패 2장을 버리고 체력을 1 회복할 수 있다.',
  },
  slabTheKiller: {
    id: 'slabTheKiller', name: '슬랩 더 킬러', baseHealth: 4,
    ability: '그의 뱅!을 막으려면 빗나감! 2장이 필요하다.',
  },
  suzyLafayette: {
    id: 'suzyLafayette', name: '수지 라파예트', baseHealth: 4,
    ability: '손패가 모두 떨어지면 즉시 카드 1장을 뽑는다.',
  },
  vultureSam: {
    id: 'vultureSam', name: '벌처 샘', baseHealth: 4,
    ability: '다른 플레이어가 사망하면 그의 손패와 장비를 모두 가져온다.',
  },
  willyTheKid: {
    id: 'willyTheKid', name: '윌리 더 키드', baseHealth: 4,
    ability: '한 턴에 뱅!을 원하는 만큼 낼 수 있다.',
  },
};

export const ALL_CHARACTERS: CharacterId[] = Object.keys(CHARACTERS) as CharacterId[];
