// 5. 발송 시점 안내: 지금 보낼지, 다음 영업일 오전에 보낼지 추천만 한다.
// (앱은 메일을 보내거나 예약하지 않는다.)
//
// 판단 순서 (긴급도 > 현재 요일·시간 > 다음 영업일)
//   1) 필요일이 이미 지났거나, 다음 영업일에 보내면 늦거나 당일이 됨 → 지금 (urgent)
//   2) 금요일 17시 이후·주말 → 다음 영업일 오전 9시 추천 (wait)
//   3) 그 외 → 지금 보내도 괜찮음 (ok)

import { addDays, daysBetween, formatMD, todayISO } from './dates.js';
import { leftText } from './priority.js';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const SEND_TIME = '09:00';
const FRIDAY_LATE = '17:00';

/** clock = { date: 'YYYY-MM-DD', time: 'HH:MM' } */
function dow(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const isWeekend = (iso) => dow(iso) === 0 || dow(iso) === 6;
const dayLabel = (iso) => `${DOW[dow(iso)]} ${formatMD(iso)}`; // '월 10/5'

/** '?now=2026-10-02T17:20' → { date, time }. 형식이 다르면 null */
export function parseNow(value) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value || '');
  return m ? { date: m[1], time: m[2] } : null;
}

/** 기기 시각 → { date, time } */
export function clockOf(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return { date: todayISO(now), time: `${p(now.getHours())}:${p(now.getMinutes())}` };
}

/** 사람들이 메일을 잘 안 보는 시간: 금요일 17시 이후, 주말 */
export function isOffHours({ date, time }) {
  return isWeekend(date) || (dow(date) === 5 && time >= FRIDAY_LATE);
}

export function nextBusinessDay(date) {
  let d = addDays(date, 1);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

/**
 * @returns {{
 *   kind: 'ok' | 'wait' | 'urgent',
 *   nowLabel: string,          // '금 17:20'
 *   title: string,             // 한 줄 핵심 메시지
 *   recommend: string | null,  // 추천 발송 시점 문장
 *   reason: string | null,     // 짧은 이유
 *   chips: { label, value }[]  // 지금 / 추천 / 필요일
 * }}
 */
export function sendTiming(clock, neededOn) {
  const nowLabel = `${DOW[dow(clock.date)]} ${clock.time}`;
  const left = daysBetween(clock.date, neededOn);
  const off = isOffHours(clock);
  const when = isWeekend(clock.date) ? '주말' : '금요일 늦은 시간';
  const next = nextBusinessDay(clock.date);
  const slack = daysBetween(next, neededOn); // 다음 영업일에 보내도 필요일까지 남는 날
  const needChip = (extra) => ({ label: '필요일', value: dayLabel(neededOn), extra });

  // 1) 긴급도: 지연이거나, 미루면 다음 영업일이 필요일 당일이거나 그 뒤
  if (left < 0 || slack <= 0) {
    const late = left < 0;
    const because = late
      ? `필요일(${formatMD(neededOn)})이 이미 지났어요.`
      : `다음 영업일(${dayLabel(next)})에 보내면 필요일에 맞추기 어려워요.`;
    return {
      kind: 'urgent',
      nowLabel,
      title: late ? '필요일이 지나 지금 발송하는 편이 나아요' : '필요일이 임박해 있어 지금 발송하는 편이 나아요',
      recommend: null,
      reason: off ? `${when}이지만, ${because}` : because,
      chips: [{ label: '지금', value: nowLabel }, needChip(leftText(left))],
    };
  }

  // 2) 요일·시간: 일반 시간이면 짧은 안내만
  if (!off) {
    return { kind: 'ok', nowLabel, title: '지금 보내도 괜찮아요', recommend: null, reason: null, chips: [] };
  }

  // 3) 다음 영업일: 여유가 있으니 오전 9시 추천
  return {
    kind: 'wait',
    nowLabel,
    title: '지금 보내면 묻힐 수 있어요',
    recommend: `${DOW[dow(next)]}요일 오전 9시 발송을 추천해요`,
    reason: `${when}이고, 필요일까지 여유가 있어요.`,
    chips: [
      { label: '지금', value: nowLabel },
      { label: '추천', value: `${dayLabel(next)} ${SEND_TIME}` },
      needChip(slack === 1 ? '하루 여유' : `${slack}일 여유`),
    ],
  };
}
