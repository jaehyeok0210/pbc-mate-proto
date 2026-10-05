// 대시보드 타임라인의 판단 로직: 기준(필요일 / 요청 경과)에 따라 자료를 축 위에 놓고,
// 같은 날에 놓이는 자료는 한 표시로 묶고, 라벨끼리 겹치지 않게 위·아래와 펼치는 방향을 정한다.

/** 요청 후 경과일 구간. 7일이면 메일 톤을 한 단계 올리는 기준(tone.js)과 같다. */
export const WAIT_BANDS = { mid: 7, high: 14 };

export function waitBand(elapsed) {
  if (elapsed >= WAIT_BANDS.high) return 'high';
  if (elapsed >= WAIT_BANDS.mid) return 'mid';
  return 'low';
}

/**
 * 축의 길이(일)와 각 자료의 위치(0~1).
 *  need:    왼쪽 끝이 오늘, 오른쪽으로 필요일이 멀어진다 (지난 자료는 오늘에 붙는다)
 *  elapsed: 오른쪽 끝이 오늘, 왼쪽으로 갈수록 오래전에 요청한 자료
 */
export function axisSpan(items, mode) {
  const far = items.length ? Math.max(...items.map((x) => (mode === 'elapsed' ? x.elapsed : x.left))) : 0;
  return Math.max(15, far + 1);
}

export function axisPos(item, mode, span) {
  if (mode === 'elapsed') return (span - Math.min(span, Math.max(0, item.elapsed))) / span;
  return Math.min(span, Math.max(0, item.left)) / span;
}

/**
 * 같은 날(필요일 / 요청일)인 자료를 한 표시로 묶는다. items는 우선순위 순서이고, 묶음의 첫 자료가 대표다.
 * 필요일이 지난 자료들은 모두 오늘 위치에 놓이지만 날짜가 다르면 따로 표시한다.
 */
export function groupMarks(items, mode, span) {
  const dayOf = (x) => (mode === 'elapsed' ? x.elapsed : x.left);
  const byDay = new Map();
  for (const x of items) {
    if (!byDay.has(dayOf(x))) byDay.set(dayOf(x), []);
    byDay.get(dayOf(x)).push(x);
  }
  return [...byDay]
    .map(([, group]) => ({ pos: axisPos(group[0], mode, span), items: group }))
    .sort((a, b) => a.pos - b.pos || dayOf(a.items[0]) - dayOf(b.items[0]));
}

/** 라벨 너비 어림값(px): 한글은 글자 크기만큼, 숫자·영문·기호는 약 0.6배. 제목은 화면에서 170px까지만 보인다. */
export const TITLE_MAX = 170;
export function labelWidth(title, sub) {
  const w = (s, px) => [...String(s)].reduce((sum, ch) => sum + (/[\u3131-\uD79D]/.test(ch) ? px : px * 0.6), 0);
  return Math.ceil(Math.max(Math.min(w(title, 12.5), TITLE_MAX), w(sub, 11)) + 22);
}

const GAP = 8;     // 라벨 사이 최소 간격
const INSET = 12;  // 점에서 라벨 모서리까지

/**
 * 라벨 배치: 왼쪽부터 차례로 위·아래를 번갈아 두되, 겹치면 반대쪽 → 반대 방향으로 펼치기 순으로 시도한다.
 * 어디에도 자리가 없으면 바로 앞 표시에 합친다(그 라벨의 'n건'에 더해진다).
 * @param marks [{ pos, items, width }]  pos 오름차순
 * @param trackPx 트랙 너비 어림값
 * @returns [{ pos, items, side: 'above'|'below', anchor: 'start'|'end' }]
 */
export function layoutLabels(marks, trackPx = 1100) {
  const placed = [];
  const boxes = { above: [], below: [] };
  const free = (side, [l, r]) => boxes[side].every(([a, b]) => r + GAP <= a || l >= b + GAP);
  marks.forEach((m, i) => {
    const x = m.pos * trackPx;
    const first = i % 2 === 0 ? 'above' : 'below';
    const other = first === 'above' ? 'below' : 'above';
    const preferEnd = m.pos > 0.85;
    const box = (anchor) => (anchor === 'start' ? [x - INSET, x - INSET + m.width] : [x + INSET - m.width, x + INSET]);
    const anchors = preferEnd ? ['end', 'start'] : ['start', 'end'];
    const tries = [first, other].flatMap((side) => anchors.map((anchor) => ({ side, anchor })));
    const fit = tries.find(({ side, anchor }) => free(side, box(anchor)));
    if (fit) {
      boxes[fit.side].push(box(fit.anchor));
      placed.push({ ...m, ...fit });
    } else if (placed.length) {
      const prev = placed[placed.length - 1];
      prev.items = [...prev.items, ...m.items];
    } else {
      placed.push({ ...m, side: first, anchor: anchors[0] });
    }
  });
  return placed;
}
