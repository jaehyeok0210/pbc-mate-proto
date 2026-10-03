// 날짜는 모두 'YYYY-MM-DD' 문자열로 다룬다. 시간대 영향을 없애려고 UTC 자정으로 계산한다.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** from → to 까지 며칠인지. to가 더 이르면 음수. */
export function daysBetween(from, to) {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

export function addDays(iso, days) {
  return fromUTC(toUTC(iso) + days * DAY_MS);
}

/** '2026-10-02' → '10/2' */
export function formatMD(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

/** '2026-10-01' → '10월 1일 (목)' */
export function formatKoreanDay(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(toUTC(iso)).getUTCDay()]})`;
}

/** '2026-10-02' → '10/2 (금)' */
export function formatMDW(iso) {
  return `${formatMD(iso)} (${WEEKDAYS[new Date(toUTC(iso)).getUTCDay()]})`;
}

/** 기기 시간 기준 오늘 날짜 */
export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
