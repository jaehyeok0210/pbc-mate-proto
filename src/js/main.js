// 진입점: 상태를 불러와 화면을 그리고, data-action 클릭을 처리한다.
// 화면 주소: (없음) 대시보드 · #/compose/<자료id> 단건 독촉 · #/bundle/<담당자> 묶음 독촉
//           #/fix/<자료id> 보완 요청 · #/add 자료 추가 (#/add/paste 붙여넣기 탭) · #/report 주간 현황
//           #/calendar 일정

import { todayISO } from './lib/dates.js';
import { withDays } from './lib/priority.js';
import { recommendTone } from './lib/tone.js';
import { buildMail, mailToText } from './lib/mail.js';
import { bundleItems, bundleTone, buildBundleMail, bundleMailToText } from './lib/bundle.js';
import { canOpenFix, currentFixReason, buildFixMail, fixMailToText } from './lib/fix.js';
import { parseNow, clockOf } from './lib/timing.js';
import { validateItem, parsePaste } from './lib/add.js';
import { josa } from './lib/korean.js';
import { buildReport, reportToText, reportToCsv, csvFileName } from './lib/report.js';
import { monthOf, shiftMonth, addEvent, removeEvent, moveEntry, setEventProgress, progressLabel } from './lib/calendar.js';
import { formatMD } from './lib/dates.js';
import { validateTransition } from './lib/status.js';
import { validateEngagement } from './lib/engagement.js';
import { load, save, clear, sampleState, baseDateOf, copyAndRecord, copyAndRecordFix, addItems, updateItemStatus, createEmptyState } from './store.js';
import { renderDashboard } from './views/dashboard.js';
import { renderEmpty } from './views/empty.js';
import { renderCompose } from './views/compose.js';
import { renderBundle } from './views/bundle.js';
import { renderFix } from './views/fix.js';
import { renderAdd, pastePreview, pasteSubmit } from './views/add.js';
import { renderReport } from './views/report.js';
import { renderStatusSheet } from './views/status.js';
import { renderCalendar } from './views/calendar.js';

// ?today=2026-10-01 처럼 기준일을 직접 지정해 확인할 수 있다.
// ?now=2026-10-02T17:20 은 날짜와 시각을 함께 지정한다 (발송 시점 안내 확인용).
const params = new URLSearchParams(location.search);
const nowParam = parseNow(params.get('now'));
const todayParam = params.get('today') || nowParam?.date || null;

const app = document.getElementById('app');
let state = load();
let mode = 'need';
let compose = null; // 단건 독촉 화면 상태: { itemId, tone, copied, toast }
let bundle = null;  // 묶음 독촉 화면 상태: { owner, tone, copied, toast }
let fix = null;     // 보완 요청 화면 상태: { itemId, reason, copied, toast }
let add = null;     // 자료 추가 화면 상태: { tab, form, errors, pasteText }
let sheet = null;   // 상태 변경 시트: { itemId, status, reason, basisDate, requiredBasisDate, errors }
let emptyForm = { clientName: '', engagement: '', errors: {} }; // 첫 실행 화면 입력값
let cal = null;     // 일정 탭 상태: { month, selected, form: { title, errors }, filter }

function currentToday() {
  return baseDateOf(state, todayParam, todayISO());
}

// 발송 시점 안내에 쓰는 현재 시각: 날짜는 기준일, 시각은 ?now 또는 기기 시각
function currentClock() {
  return { date: currentToday(), time: nowParam?.time || clockOf().time };
}

function routeParam(name) {
  const m = location.hash.match(new RegExp(`^#/${name}/(.+)$`));
  return m ? decodeURIComponent(m[1]) : null;
}

// 묶음 대상이 2건 이상일 때만 묶음 화면을 연다.
function currentBundle(today) {
  const owner = routeParam('bundle');
  if (!owner) return null;
  const sorted = bundleItems(state.items, owner, today);
  return sorted.length > 1 ? { owner, sorted } : null;
}

function render() {
  if (!state) { app.innerHTML = renderEmpty(emptyForm); return; }
  const today = currentToday();
  const isDemo = !todayParam && Boolean(state.demoDate);

  // 일정 탭: 대시보드 대신 그리는 전체 화면
  if (location.hash === '#/calendar') {
    compose = bundle = fix = add = sheet = null;
    if (!cal) cal = { month: monthOf(today), selected: today, form: { title: '', errors: {} }, filter: 'all' };
    app.innerHTML = renderCalendar(state, { today, isDemo, ...cal });
    document.body.classList.remove('has-drawer');
    return;
  }

  // 주간 현황은 대시보드 대신 그리는 전체 화면. 패널(독촉·보완·추가)은 대시보드 위에서만 연다.
  if (location.hash === '#/report') {
    compose = bundle = fix = add = sheet = null;
    app.innerHTML = renderReport(state, buildReport(state, today), { today, isDemo });
    document.body.classList.remove('has-drawer');
    return;
  }

  let html = renderDashboard(state, { today, mode, isDemo });

  const id = routeParam('compose');
  const item = id && state.items.find((x) => x.id === id && x.status !== 'done');
  if (item) {
    // 화면을 새로 열 때만 추천 톤으로 시작한다. 이후엔 사용자가 고른 톤 유지.
    if (compose?.itemId !== id) {
      compose = { itemId: id, tone: recommendTone(withDays(item, today)), copied: false, toast: false };
    }
    html += renderCompose(state, { today, clock: currentClock(), ...compose });
  } else {
    compose = null;
  }

  const b = currentBundle(today);
  if (b) {
    if (bundle?.owner !== b.owner) {
      bundle = { owner: b.owner, tone: bundleTone(b.sorted), copied: false, toast: false };
    }
    html += renderBundle(state, { sorted: b.sorted, clock: currentClock(), ...bundle });
  } else {
    bundle = null;
  }

  const fixId = routeParam('fix');
  const fixItem = fixId && state.items.find((x) => x.id === fixId);
  if (canOpenFix(fixItem)) {
    if (fix?.itemId !== fixId) {
      fix = { itemId: fixId, reason: currentFixReason(fixItem), copied: false, toast: false };
    }
    html += renderFix(state, { today, ...fix });
  } else {
    fix = null;
  }

  const addRoute = location.hash === '#/add' || location.hash === '#/add/paste';
  if (addRoute) {
    if (!add) add = { tab: location.hash.endsWith('/paste') ? 'paste' : 'single', form: {}, errors: {}, pasteText: '' };
    html += renderAdd(state, { today, ...add });
  } else {
    add = null;
  }

  // 상태 변경 시트는 단건 독촉·보완 요청 패널이 열려 있을 때만 그 위에 뜬다.
  const sheetItem = sheet && (item || fixItem) && state.items.find((x) => x.id === sheet.itemId);
  if (sheetItem && sheetItem.status !== 'done') {
    html += renderStatusSheet(sheetItem, sheet, today);
  } else {
    sheet = null;
  }

  const focusedTone = document.activeElement?.dataset?.tone;
  const focusedReason = document.activeElement?.dataset?.reason;
  app.innerHTML = html;
  document.body.classList.toggle('has-drawer', Boolean(item || b || fix || add));
  // 톤·사유를 바꾼 뒤에도 키보드 포커스가 같은 버튼에 남도록 (데스크톱·모바일 중 보이는 쪽)
  if (focusedTone) {
    [...app.querySelectorAll(`[data-tone="${focusedTone}"]`)].find((b) => b.offsetParent)?.focus();
  }
  if (focusedReason) app.querySelector(`[data-reason="${focusedReason}"]`)?.focus();
}

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // clipboard API가 막힌 환경용 대체 방법
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function closeDrawer() {
  // 샌드박스(iframe)에서는 pushState가 막힐 수 있어 해시를 비우는 방식으로 대신한다.
  try { history.pushState(null, '', location.pathname + location.search); }
  catch { location.hash = ''; }
  render();
}

// 복사 성공 시에만 이력을 남기고, 화면 상태(copied·toast)를 갱신한다.
// record: 기본은 독촉 이력. 보완 요청은 copyAndRecordFix를 넘긴다.
let drawerToastTimer;
async function copyForDrawer(view, { itemIds, text }, record) {
  const result = record
    ? await record(state, currentToday(), text, copyText)
    : await copyAndRecord(state, { itemIds, tone: view.tone, on: currentToday(), text }, copyText);
  if (!result.ok) {
    toast('복사하지 못했어요. 미리보기에서 직접 선택해 복사해 주세요.');
    return;
  }
  state = result.state;
  save(state);
  view.copied = true;
  view.toast = true;
  render();
  clearTimeout(drawerToastTimer);
  drawerToastTimer = setTimeout(() => { view.toast = false; render(); }, 2800);
}

const actions = {
  'set-mode': (el) => { mode = el.dataset.mode; render(); },
  'load-sample': () => { state = sampleState(); save(state); render(); },

  // 첫 실행: 클라이언트명·감사명을 넣고 빈 state로 시작 → 자료 추가 화면으로
  'start-blank': (el) => {
    const form = document.getElementById('engagement-form');
    emptyForm = { clientName: form.clientName.value, engagement: form.engagement.value, errors: {} };
    emptyForm.errors = validateEngagement(emptyForm);
    if (Object.keys(emptyForm.errors).length) {
      render();
      app.querySelector('.empty-form .has-error input')?.focus();
      return;
    }
    state = createEmptyState(emptyForm);
    save(state);
    emptyForm = { clientName: '', engagement: '', errors: {} };
    location.hash = el.dataset.target === 'paste' ? '#/add/paste' : '#/add';
    render();
  },

  // 자료 상태 변경 시트
  'open-status': (el) => {
    sheet = { itemId: el.dataset.item, status: null, reason: null, basisDate: '', requiredBasisDate: '', errors: {} };
    render();
  },
  'close-status': () => { sheet = null; render(); },
  'pick-status': (el) => {
    readSheetDates();
    sheet.status = el.dataset.status;
    sheet.errors = {};
    if (sheet.status === 'fix' && !sheet.reason) sheet.reason = 'date';
    render();
  },
  'pick-fix-reason': (el) => { readSheetDates(); sheet.reason = el.dataset.reason; sheet.errors = {}; render(); },
  'save-status': () => {
    readSheetDates();
    const item = state.items.find((x) => x.id === sheet.itemId);
    const change = { status: sheet.status, reason: sheet.reason, basisDate: sheet.basisDate, requiredBasisDate: sheet.requiredBasisDate };
    sheet.errors = validateTransition(item, change);
    if (Object.keys(sheet.errors).length) { render(); return; }

    state = updateItemStatus(state, item.id, change, currentToday());
    save(state);
    sheet = null;
    const name = `‘${item.name}’${josa(item.name, '을', '를')}`;
    if (change.status === 'done') {
      closeDrawer();
      toast(`${name} 완료로 처리했어요.`);
    } else if (change.status === 'fix') {
      location.hash = `#/fix/${encodeURIComponent(item.id)}`;
      render();
      toast(`${name} 보완 요청으로 바꿨어요. 사유에 맞는 재요청 메일을 준비했어요.`);
    } else {
      location.hash = `#/compose/${encodeURIComponent(item.id)}`;
      render();
      toast(`${name} 일부 수령으로 바꿨어요. 나머지는 계속 독촉할 수 있어요.`);
    }
  },

  'set-tone': (el) => { compose.tone = el.dataset.tone; compose.copied = false; render(); },
  'close-compose': closeDrawer,
  'close-drawer': closeDrawer,
  'copy-mail': () => {
    const today = currentToday();
    const item = withDays(state.items.find((x) => x.id === compose.itemId), today);
    const mail = buildMail({
      item, person: state.people[item.owner], client: state.client,
      manager: state.team?.manager, today, tone: compose.tone,
    });
    return copyForDrawer(compose, { itemIds: [item.id], text: mailToText(mail) });
  },
  'set-reason': (el) => { fix.reason = el.dataset.reason; fix.copied = false; render(); },

  // 자료 추가
  'add-tab': (el) => {
    if (add.tab === 'single') add.form = readAddForm();
    add.tab = el.dataset.tab;
    add.errors = {};
    render();
  },
  'pick-owner': (el) => {
    const [name, ...title] = el.dataset.owner.split(' ');
    const form = document.getElementById('add-form');
    form.ownerName.value = name;
    form.ownerTitle.value = title.join(' ');
    if (!form.dept.value) form.dept.value = el.dataset.dept;
    form.ownerName.focus();
  },
  // 주간 현황: 복사와 CSV 내려받기. 메일·메신저로 보내지는 않는다.
  'copy-report': async () => {
    const ok = await copyText(reportToText(buildReport(state, currentToday())));
    toast(ok ? '현황을 복사했어요. 아웃룩이나 메신저에 붙여넣으세요.' : '복사하지 못했어요. 화면 내용을 직접 선택해 복사해 주세요.');
  },
  'download-csv': () => {
    const report = buildReport(state, currentToday());
    const blob = new Blob([reportToCsv(report)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: csvFileName(report) });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${csvFileName(report)} 파일을 내려받았어요.`);
  },
  // 일정 탭
  'cal-month': (el) => { cal.month = shiftMonth(cal.month, Number(el.dataset.delta)); render(); },
  'cal-today': () => { const t = currentToday(); cal.month = monthOf(t); cal.selected = t; render(); },
  'cal-select': (el) => { cal.selected = el.dataset.date; cal.form.errors = {}; render(); },
  'cal-filter': (el) => { cal.filter = el.dataset.filter; render(); },
  'cal-progress': (el) => {
    state = setEventProgress(state, el.dataset.event, el.dataset.progress);
    save(state);
    render();
    toast(`일정을 ‘${progressLabel(el.dataset.progress)}’으로 표시했어요.`);
  },
  'cal-remove-event': (el) => {
    state = removeEvent(state, el.dataset.event);
    save(state);
    render();
    toast('일정을 삭제했어요.');
  },
  // 메일 패널의 날짜 칩 '+' (드래그 대신 탭으로 추가)
  'add-mail-date': (el) => {
    const chip = el.closest('[data-drag-date]');
    addMailDate({ title: chip.dataset.title, date: chip.dataset.date, itemId: chip.dataset.item || null });
  },
  'add-paste': () => {
    const today = currentToday();
    const parsed = parsePaste(add.pasteText, today);
    if (!parsed.rows.length || parsed.errorCount) return;
    state = addItems(state, parsed.rows.map((r) => r.value));
    save(state);
    add = null;
    closeDrawer();
    toast(`${parsed.rows.length}건 추가했어요.`);
  },
  'copy-fix': () => {
    const today = currentToday();
    const item = withDays(state.items.find((x) => x.id === fix.itemId), today);
    const mail = buildFixMail({ item, person: state.people[item.owner], client: state.client, today, reason: fix.reason });
    const reason = fix.reason;
    return copyForDrawer(fix, { text: fixMailToText(mail) },
      (s, on, text, copy) => copyAndRecordFix(s, { itemId: item.id, reason, on, text }, copy));
  },
  'copy-bundle': () => {
    const sorted = bundleItems(state.items, bundle.owner, currentToday());
    const mail = buildBundleMail({
      sorted, person: state.people[bundle.owner], client: state.client,
      manager: state.team?.manager, tone: bundle.tone,
    });
    return copyForDrawer(bundle, { itemIds: sorted.map((x) => x.id), text: bundleMailToText(mail) });
  },
};

// 시트의 기준일 입력값을 상태에 옮겨 둔다 (다시 그려도 입력이 남도록)
function readSheetDates() {
  const root = document.querySelector('.sheet');
  if (!root || !sheet) return;
  sheet.basisDate = root.querySelector('[name="basisDate"]')?.value ?? sheet.basisDate;
  sheet.requiredBasisDate = root.querySelector('[name="requiredBasisDate"]')?.value ?? sheet.requiredBasisDate;
}

// 메일 속 날짜를 캘린더 일정으로 추가 (드롭·탭 공통)
function addMailDate({ title, date, itemId }) {
  const result = addEvent(state, { title, date, itemId: itemId || null });
  if (!result.added) { toast('이미 캘린더에 있는 일정이에요.'); return; }
  state = result.state;
  save(state);
  render();
  toast(`‘${title}’ ${formatMD(date)} 일정을 캘린더에 추가했어요.`);
}

// 달력 항목을 다른 날로 (드래그·날짜 입력 공통). 필요일이면 자료의 필요일 자체가 바뀐다.
function moveCalendarEntry(entryId, date) {
  if (!date) return;
  const before = state;
  state = moveEntry(state, entryId, date);
  if (state === before) return;
  save(state);
  if (cal) cal.selected = date;
  render();
  const [kind, id] = entryId.split(':');
  if (kind === 'need') {
    const item = state.items.find((x) => x.id === id);
    toast(`‘${item.name}’ 필요일을 ${formatMD(date)}로 옮겼어요. 우선순위와 메일 문구에 반영돼요.`);
  } else {
    toast(`일정을 ${formatMD(date)}로 옮겼어요.`);
  }
}

// 드래그앤드롭: 달력 항목(data-drag-entry) 또는 메일 날짜 칩(data-drag-date)을 날짜 칸/일정 패널/독에 놓는다.
app.addEventListener('dragstart', (e) => {
  const el = e.target.closest?.('[data-drag-entry], [data-drag-date]');
  if (!el) return;
  const payload = el.dataset.dragEntry
    ? { type: 'entry', id: el.dataset.dragEntry }
    : { type: 'date', title: el.dataset.title, date: el.dataset.date, itemId: el.dataset.item || null };
  e.dataTransfer.setData('text/plain', JSON.stringify(payload));
  e.dataTransfer.effectAllowed = 'move';
  el.classList.add('is-dragging');
});
app.addEventListener('dragend', (e) => e.target.classList?.remove('is-dragging'));
app.addEventListener('dragover', (e) => {
  const zone = e.target.closest?.('[data-drop]');
  if (!zone) return;
  e.preventDefault();
  zone.classList.add('is-over');
});
app.addEventListener('dragleave', (e) => e.target.closest?.('[data-drop]')?.classList.remove('is-over'));
app.addEventListener('drop', (e) => {
  const zone = e.target.closest?.('[data-drop]');
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove('is-over');
  let payload;
  try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
  const target = zone.dataset.drop;
  if (payload.type === 'date') {
    addMailDate({ ...payload, date: target === 'dock' ? payload.date : target });
  } else if (payload.type === 'entry' && target !== 'dock') {
    moveCalendarEntry(payload.id, target);
  }
});

// 일정 패널의 날짜 입력으로 이동 (모바일·키보드)
app.addEventListener('change', (e) => {
  if (e.target.dataset.actionChange === 'cal-move') moveCalendarEntry(e.target.dataset.entry, e.target.value);
});

function readAddForm() {
  const form = document.getElementById('add-form');
  if (!form) return add?.form || {};
  return Object.fromEntries(['name', 'ownerName', 'ownerTitle', 'dept', 'requestedOn', 'neededOn', 'procedure']
    .map((k) => [k, form[k]?.value ?? '']));
}

// 일정 추가 (일정 탭 오른쪽 패널)
app.addEventListener('submit', (e) => {
  if (e.target.dataset.actionSubmit !== 'cal-add-event') return;
  e.preventDefault();
  const title = e.target.title.value.trim();
  if (!title) {
    cal.form = { title: '', errors: { title: '일정 이름을 입력해 주세요.' } };
    render();
    app.querySelector('.cal-add input')?.focus();
    return;
  }
  const result = addEvent(state, { title, date: cal.selected });
  if (result.added) { state = result.state; save(state); }
  cal.form = { title: '', errors: {} };
  render();
  toast(result.added ? `‘${title}’ 일정을 ${formatMD(cal.selected)}에 추가했어요.` : '같은 일정이 이미 있어요.');
});

// 한 건 저장: 검증에 걸리면 입력값을 유지한 채 오류를 보여준다.
app.addEventListener('submit', (e) => {
  if (e.target.dataset.actionSubmit !== 'add-single') return;
  e.preventDefault();
  const today = currentToday();
  add.form = readAddForm();
  const { errors, value } = validateItem(add.form, today);
  add.errors = errors;
  if (!value) {
    render();
    app.querySelector('.f.has-error input')?.focus();
    return;
  }
  state = addItems(state, [value]);
  save(state);
  add = null;
  closeDrawer();
  toast(`‘${value.item.name}’${josa(value.item.name, '을', '를')} 추가했어요.`);
});

// 붙여넣기: 입력할 때마다 미리보기와 저장 버튼만 갱신한다 (textarea 포커스 유지).
app.addEventListener('input', (e) => {
  if (e.target.dataset.actionInput === 'paste') {
    add.pasteText = e.target.value;
    const parsed = parsePaste(add.pasteText, currentToday());
    app.querySelector('.paste-preview').innerHTML = pastePreview(parsed, currentToday());
    app.querySelector('.modal-foot .btn-cta').outerHTML = pasteSubmit(parsed);
  } else if (e.target.name === 'neededOn' && e.target.form?.id === 'add-form') {
    add.form = readAddForm();
    add.errors = {};
    render();
    app.querySelector('[name="neededOn"]')?.focus();
  }
});

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  actions[el.dataset.action]?.(el);
});

window.addEventListener('hashchange', render);
window.addEventListener('popstate', render);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (sheet) { sheet = null; render(); return; }
  if (compose || bundle || fix || add) closeDrawer();
});

// 개발용: 콘솔에서 pbc.reset() 하면 첫 실행 화면으로 돌아간다.
window.pbc = { reset() { clear(); state = null; compose = bundle = fix = add = sheet = cal = null; render(); } };

render();
