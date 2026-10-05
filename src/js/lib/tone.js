// 요청 메일 톤 4단계와 기본 추천 규칙

export const TONES = [
  { key: 'angel', name: '천사', emoji: '😇' },
  { key: 'polite', name: '정중', emoji: '🙂' },
  { key: 'firm', name: '단호', emoji: '😐' },
  { key: 'cc', name: '매니저 참조', emoji: '🔥' },
];

export function toneIndex(key) {
  return TONES.findIndex((t) => t.key === key);
}

export function toneName(key) {
  return TONES[toneIndex(key)]?.name ?? key;
}

/**
 * 기본 추천 톤.
 * 1) 필요일까지 남은 날로 출발: 지연 → 단호, 2일 이내 → 정중, 그 외 → 천사
 * 2) 요청한 지 7일 이상 지났으면 한 단계 올린다 (최대 매니저 참조)
 */
export function recommendTone({ left, elapsed }) {
  let level = left < 0 ? 2 : left <= 2 ? 1 : 0;
  if (elapsed >= 7) level += 1;
  return TONES[Math.min(level, TONES.length - 1)].key;
}

/** 추천 근거: '남은 1일 · 요청 후 3일' */
export function recommendBasis({ left, elapsed }) {
  const leftPart = left < 0 ? `필요일 ${-left}일 지남` : left === 0 ? '오늘 필요' : `남은 ${left}일`;
  return `${leftPart} · 요청 후 ${elapsed}일`;
}
