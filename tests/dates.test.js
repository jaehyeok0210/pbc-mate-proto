import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, addDays, formatMD, formatKoreanDay, todayISO } from '../src/js/lib/dates.js';

test('daysBetween: 앞뒤 방향과 월 경계', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-02'), 1);
  assert.equal(daysBetween('2026-10-01', '2026-09-28'), -3);
  assert.equal(daysBetween('2026-09-30', '2026-10-20'), 20);
  assert.equal(daysBetween('2026-10-01', '2026-10-01'), 0);
});

test('addDays: 월·연 경계를 넘는다', () => {
  assert.equal(addDays('2026-10-01', -3), '2026-09-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('formatMD / formatKoreanDay', () => {
  assert.equal(formatMD('2026-10-02'), '10/2');
  assert.equal(formatKoreanDay('2026-10-01'), '10월 1일 (목)');
  assert.equal(formatKoreanDay('2026-10-04'), '10월 4일 (일)');
});

test('todayISO: 기기 시간 기준 날짜', () => {
  assert.equal(todayISO(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});
