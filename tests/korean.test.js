import { test } from 'node:test';
import assert from 'node:assert/strict';
import { josa } from '../src/js/lib/korean.js';

test('받침 있으면 첫째, 없으면 둘째 조사', () => {
  assert.equal(josa('은행조회서 회신', '이', '가'), '이');
  assert.equal(josa('매출채권 연령분석표', '이', '가'), '가');
  assert.equal(josa('재고실사 결과표', '을', '를'), '를');
});

test('한글로 끝나지 않으면 둘 다 표기', () => {
  assert.equal(josa('Form 10-K', '이', '가'), '이(가)');
});
