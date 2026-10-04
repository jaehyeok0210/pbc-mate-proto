// 6. 자료 추가: 한 건씩 입력하거나, 엑셀에서 복사한 행을 붙여넣어 여러 건을 등록한다.
// 저장은 store.js의 addItems가 하고, 여기서는 검증·변환만 한다.

import { daysBetween } from './dates.js';

/**
 * 날짜 문자열 → 'YYYY-MM-DD'. 못 읽으면 null.
 * 허용: 2026-09-30 · 2026.9.30 · 2026. 9. 30. · 2026/9/30 · 9/30 (연도는 baseDate 기준)
 */
export function normalizeDate(input, baseDate) {
  const s = String(input ?? '').trim().replace(/\s+/g, '').replace(/\.$/, '');
  if (!s) return null;
  let y; let m; let d;
  let full = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(s);
  if (full) [, y, m, d] = full.map(Number);
  else if ((full = /^(\d{1,2})[/.](\d{1,2})$/.exec(s))) {
    [, m, d] = full.map(Number);
    y = Number(baseDate.slice(0, 4));
  } else return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  if (!valid) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}

/** 담당자 표시 이름: '김민지' + '대리' → '김민지 대리' */
export function ownerName(name, title) {
  return [name, title].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
}

/**
 * 한 건 입력값 검증.
 * fields: { name, ownerName, ownerTitle?, dept?, requestedOn, neededOn, procedure? }
 * 새 요청 자료는 항상 '미회신'으로 시작한다. 이후 상태는 상태 변경 기능으로 바꾼다.
 * @returns {{ errors: Record<string,string>, value: object | null }}
 */
export function validateItem(fields, baseDate) {
  const errors = {};
  const name = String(fields.name ?? '').trim();
  const owner = ownerName(fields.ownerName, fields.ownerTitle);
  const requestedOn = normalizeDate(fields.requestedOn, baseDate);
  const neededOn = normalizeDate(fields.neededOn, baseDate);

  if (!name) errors.name = '자료명을 입력해 주세요.';
  if (!String(fields.ownerName ?? '').trim()) errors.ownerName = '담당자 이름을 입력해 주세요.';
  if (!String(fields.requestedOn ?? '').trim()) errors.requestedOn = '요청일을 입력해 주세요.';
  else if (!requestedOn) errors.requestedOn = '날짜 형식을 확인해 주세요. 예: 2026-09-30';
  if (!String(fields.neededOn ?? '').trim()) errors.neededOn = '필요일을 입력해 주세요.';
  else if (!neededOn) errors.neededOn = '날짜 형식을 확인해 주세요. 예: 2026-10-07';

  if (Object.keys(errors).length) return { errors, value: null };

  const procedure = String(fields.procedure ?? '').trim();
  const dept = String(fields.dept ?? '').trim();
  return {
    errors,
    value: {
      item: { name, owner, requestedOn, neededOn, status: 'none', ...(procedure && { procedure }), nudges: [] },
      person: { owner, dept },
    },
  };
}

const HEADER_WORDS = ['자료명', '자료', '담당자', '요청일', '필요일', '감사절차', '감사 절차', '절차'];

/** 한 줄을 열로 나눈다. 탭이 없으면 공백 2칸 이상으로도 나눠 본다. */
export function splitCells(line) {
  const cells = line.includes('\t') ? line.split('\t') : line.split(/ {2,}/);
  return cells.map((c) => c.trim());
}

function isHeaderRow(cells) {
  return cells.filter(Boolean).length >= 2 && cells.some((c) => HEADER_WORDS.includes(c.replace(/\s+/g, '')));
}

/**
 * 엑셀에서 복사한 텍스트 파싱.
 * 열 순서: 자료명 · 담당자 · 요청일 · 필요일 · 감사절차(선택). 탭으로 열, 줄바꿈으로 행을 나눈다.
 * @returns {{ rows: { line, cells, value, errors }[], headerSkipped: boolean, errorCount: number }}
 */
export function parsePaste(text, baseDate) {
  const lines = String(text ?? '').split(/\r?\n/).filter((l) => l.trim());
  let headerSkipped = false;
  if (lines.length && isHeaderRow(splitCells(lines[0]))) {
    lines.shift();
    headerSkipped = true;
  }

  const rows = lines.map((line, i) => {
    const cells = splitCells(line);
    const [name, owner, requestedOn, neededOn, procedure] = cells;
    const { errors, value } = validateItem(
      { name, ownerName: owner, requestedOn, neededOn, procedure }, baseDate);
    if (cells.length < 4 && !Object.keys(errors).length) errors.cells = '열이 부족해요.';
    return { line: i + 1, cells, value, errors };
  });

  return { rows, headerSkipped, errorCount: rows.filter((r) => Object.keys(r.errors).length).length };
}

/** 행 오류를 한 줄 문구로 */
export function rowErrorText(errors) {
  const order = ['name', 'ownerName', 'requestedOn', 'neededOn', 'cells'];
  const labels = { name: '자료명 없음', ownerName: '담당자 없음', cells: '열 부족' };
  return order.filter((k) => errors[k]).map((k) => {
    if (k === 'requestedOn') return errors[k].includes('형식') ? '요청일 형식 오류' : '요청일 없음';
    if (k === 'neededOn') return errors[k].includes('형식') ? '필요일 형식 오류' : '필요일 없음';
    return labels[k];
  }).join(' · ');
}

/** 미리보기용: 필요일까지 남은 날 */
export function leftOf(value, baseDate) {
  return daysBetween(baseDate, value.item.neededOn);
}
