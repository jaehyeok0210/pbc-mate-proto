import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitBand, axisSpan, axisPos, groupMarks, labelWidth, layoutLabels } from '../src/js/lib/timeline.js';

test('요청 경과 구간: 7일 미만 · 7~13일 · 14일 이상', () => {
  assert.deepEqual([0, 6, 7, 13, 14, 30].map(waitBand), ['low', 'low', 'mid', 'mid', 'high', 'high']);
});

test('축: 필요일은 왼쪽이 오늘, 요청 경과는 오른쪽이 오늘', () => {
  const items = [{ left: 3, elapsed: 10 }, { left: -2, elapsed: 1 }];
  assert.equal(axisSpan(items, 'need'), 15, '최소 15일');
  assert.equal(axisSpan([{ left: 20, elapsed: 0 }], 'need'), 21);
  assert.equal(axisSpan([{ left: 0, elapsed: 30 }], 'elapsed'), 31);
  assert.equal(axisSpan(items, 'elapsed'), 11, '요청 경과는 가장 오래된 요청에 맞춘다 (빈 구간 없이)');
  assert.equal(axisSpan([{ left: 0, elapsed: 1 }], 'elapsed'), 5, '최소 5일');
  assert.equal(axisPos({ left: -2 }, 'need', 15), 0, '지난 자료는 오늘에 붙는다');
  assert.equal(axisPos({ elapsed: 0 }, 'elapsed', 15), 1, '오늘 요청은 오른쪽 끝');
  assert.equal(axisPos({ elapsed: 15 }, 'elapsed', 15), 0, '가장 오래된 요청은 왼쪽 끝');
});

test('같은 날에 놓이는 자료는 한 표시로 묶고, 우선순위가 앞선 자료가 대표', () => {
  const items = [{ name: 'a', elapsed: 10 }, { name: 'b', elapsed: 10 }, { name: 'c', elapsed: 3 }];
  const late = groupMarks([{ name: 'x', left: -2 }, { name: 'y', left: -1 }], 'need', 15);
  assert.equal(late.length, 2, '지난 날짜가 달라도 같은 자리지만 따로 표시');
  const marks = groupMarks(items, 'elapsed', 15);
  assert.equal(marks.length, 2);
  assert.deepEqual(marks[0].items.map((x) => x.name), ['a', 'b']);
  assert.ok(marks[0].pos < marks[1].pos, '왼쪽부터');
});

test('라벨 배치: 겹치지 않으면 위·아래를 번갈아, 겹치면 다른 자리로, 자리가 없으면 앞 표시에 합친다', () => {
  const w = 200;
  const spread = layoutLabels([0.1, 0.5, 0.9].map((pos) => ({ pos, items: [pos], width: w })), 1000);
  assert.deepEqual(spread.map((m) => m.side), ['above', 'below', 'above']);
  assert.equal(spread[2].anchor, 'end', '오른쪽 끝 근처는 왼쪽으로 펼친다');

  const close = layoutLabels([0.1, 0.15, 0.2].map((pos) => ({ pos, items: [pos], width: w })), 1000);
  const boxes = close.map((m) => {
    const x = m.pos * 1000;
    return { side: m.side, box: m.anchor === 'start' ? [x - 12, x - 12 + w] : [x + 12 - w, x + 12] };
  });
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].side !== boxes[j].side) continue;
      const [a, b] = [boxes[i].box, boxes[j].box];
      assert.ok(a[1] <= b[0] || b[1] <= a[0], `겹침 없음 ${i}-${j}`);
    }
  }
  const crowded = layoutLabels([0.1, 0.11, 0.12, 0.13, 0.14].map((pos) => ({ pos, items: [pos], width: w })), 1000);
  assert.equal(crowded.flatMap((m) => m.items).length, 5, '합쳐도 자료는 빠지지 않는다');
  assert.ok(crowded.length < 5);
});

test('라벨 너비 어림값: 한글이 숫자보다 넓다', () => {
  assert.ok(labelWidth('은행조회서', '1/4') > labelWidth('12345', '1/4'));
});
