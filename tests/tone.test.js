import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TONES, toneIndex, toneName, recommendTone, recommendBasis } from '../src/js/lib/tone.js';

test('톤은 천사 → 정중 → 단호 → 매니저 참조 4단계', () => {
  assert.deepEqual(TONES.map((t) => t.name), ['천사', '정중', '단호', '매니저 참조']);
  assert.equal(toneIndex('firm'), 2);
  assert.equal(toneName('cc'), '매니저 참조');
});

test('recommendTone: 남은 날 기준 출발점', () => {
  assert.equal(recommendTone({ left: 10, elapsed: 1 }), 'angel');
  assert.equal(recommendTone({ left: 3, elapsed: 1 }), 'angel');
  assert.equal(recommendTone({ left: 2, elapsed: 1 }), 'polite');
  assert.equal(recommendTone({ left: 0, elapsed: 1 }), 'polite');
  assert.equal(recommendTone({ left: -1, elapsed: 1 }), 'firm');
});

test('recommendTone: 요청 후 7일 이상이면 한 단계 올림', () => {
  assert.equal(recommendTone({ left: 10, elapsed: 6 }), 'angel');
  assert.equal(recommendTone({ left: 10, elapsed: 7 }), 'polite');
  assert.equal(recommendTone({ left: 1, elapsed: 7 }), 'firm');
  assert.equal(recommendTone({ left: -2, elapsed: 9 }), 'cc');
});

test('recommendTone: 레퍼런스 은행조회서(남은 1일 · 요청 후 3일) → 정중', () => {
  assert.equal(recommendTone({ left: 1, elapsed: 3 }), 'polite');
});

test('recommendBasis', () => {
  assert.equal(recommendBasis({ left: 1, elapsed: 3 }), '남은 1일 · 요청 후 3일');
  assert.equal(recommendBasis({ left: 0, elapsed: 3 }), '오늘 필요 · 요청 후 3일');
  assert.equal(recommendBasis({ left: -2, elapsed: 9 }), '필요일 2일 지남 · 요청 후 9일');
});
