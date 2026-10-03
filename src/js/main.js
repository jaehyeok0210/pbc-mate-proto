// 진입점: 상태를 불러와 화면을 그리고, data-action 클릭을 처리한다.
// 화면 주소: (없음) 대시보드 · #/compose/<자료id> 단건 독촉 · #/bundle/<담당자> 묶음 독촉
//           #/fix/<자료id> 보완 요청

import { todayISO } from './lib/dates.js';
import { withDays } from './lib/priority.js';
import { recommendTone } from './lib/tone.js';
import { buildMail, mailToText } from './lib/mail.js';
import { bundleItems, bundleTone, buildBundleMail, bundleMailToText } from './lib/bundle.js';
import { canOpenFix, currentFixReason, buildFixMail, fixMailToText } from './lib/fix.js';
import { load, save, clear, sampleState, baseDateOf, copyAndRecord, copyAndRecordFix } from './store.js';
import { renderDashboard } from './views/dashboard.js';
import { renderEmpty } from './views/empty.js';
import { renderCompose } from './views/compose.js';
import { renderBundle } from './views/bundle.js';
import { renderFix } from './views/fix.js';

// ?today=2026-10-01 처럼 기준일을 직접 지정해 확인할 수 있다.
const todayParam = new URLSearchParams(location.search).get('today');

const app = document.getElementById('app');
let state = load();
let mode = 'need';
let compose = null; // 단건 독촉 화면 상태: { itemId, tone, copied, toast }
let bundle = null;  // 묶음 독촉 화면 상태: { owner, tone, copied, toast }
let fix = null;     // 보완 요청 화면 상태: { itemId, reason, copied, toast }

function currentToday() {
  return baseDateOf(state, todayParam, todayISO());
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
  if (!state) { app.innerHTML = renderEmpty(); return; }
  const today = currentToday();
  const isDemo = !todayParam && Boolean(state.demoDate);
  let html = renderDashboard(state, { today, mode, isDemo });

  const id = routeParam('compose');
  const item = id && state.items.find((x) => x.id === id && x.status !== 'done');
  if (item) {
    // 화면을 새로 열 때만 추천 톤으로 시작한다. 이후엔 사용자가 고른 톤 유지.
    if (compose?.itemId !== id) {
      compose = { itemId: id, tone: recommendTone(withDays(item, today)), copied: false, toast: false };
    }
    html += renderCompose(state, { today, ...compose });
  } else {
    compose = null;
  }

  const b = currentBundle(today);
  if (b) {
    if (bundle?.owner !== b.owner) {
      bundle = { owner: b.owner, tone: bundleTone(b.sorted), copied: false, toast: false };
    }
    html += renderBundle(state, { sorted: b.sorted, ...bundle });
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

  const focusedTone = document.activeElement?.dataset?.tone;
  const focusedReason = document.activeElement?.dataset?.reason;
  app.innerHTML = html;
  document.body.classList.toggle('has-drawer', Boolean(item || b || fix));
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
  history.pushState(null, '', location.pathname + location.search);
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
  todo: (el) => toast(`‘${el.dataset.what}’ 화면은 다음 단계에서 만들어요.`),

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

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  actions[el.dataset.action]?.(el);
});

window.addEventListener('hashchange', render);
window.addEventListener('popstate', render);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (compose || bundle || fix)) closeDrawer();
});

// 개발용: 콘솔에서 pbc.reset() 하면 첫 실행 화면으로 돌아간다.
window.pbc = { reset() { clear(); state = null; compose = null; bundle = null; fix = null; render(); } };

render();
