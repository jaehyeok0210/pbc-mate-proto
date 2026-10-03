// 진입점: 상태를 불러와 화면을 그리고, data-action 클릭을 처리한다.
// 화면 주소: (없음) 대시보드 · #/compose/<자료id> 단건 독촉

import { todayISO } from './lib/dates.js';
import { withDays } from './lib/priority.js';
import { recommendTone } from './lib/tone.js';
import { buildMail, mailToText } from './lib/mail.js';
import { load, save, clear, sampleState, baseDateOf, recordNudge } from './store.js';
import { renderDashboard } from './views/dashboard.js';
import { renderEmpty } from './views/empty.js';
import { renderCompose } from './views/compose.js';

// ?today=2026-10-01 처럼 기준일을 직접 지정해 확인할 수 있다.
const todayParam = new URLSearchParams(location.search).get('today');

const app = document.getElementById('app');
let state = load();
let mode = 'need';
let compose = null; // 단건 독촉 화면 상태: { itemId, tone, copied, toast }

function currentToday() {
  return baseDateOf(state, todayParam, todayISO());
}

function composeIdFromHash() {
  const m = location.hash.match(/^#\/compose\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function render() {
  if (!state) { app.innerHTML = renderEmpty(); return; }
  const today = currentToday();
  const isDemo = !todayParam && Boolean(state.demoDate);
  let html = renderDashboard(state, { today, mode, isDemo });

  const id = composeIdFromHash();
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

  const focusedTone = document.activeElement?.dataset?.tone;
  app.innerHTML = html;
  document.body.classList.toggle('has-drawer', Boolean(item));
  // 톤을 바꾼 뒤에도 키보드 포커스가 같은 버튼에 남도록 (데스크톱·모바일 중 보이는 쪽)
  if (focusedTone) {
    [...app.querySelectorAll(`[data-tone="${focusedTone}"]`)].find((b) => b.offsetParent)?.focus();
  }
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

function closeCompose() {
  history.pushState(null, '', location.pathname + location.search);
  render();
}

let composeToastTimer;
const actions = {
  'set-mode': (el) => { mode = el.dataset.mode; render(); },
  'load-sample': () => { state = sampleState(); save(state); render(); },
  todo: (el) => toast(`‘${el.dataset.what}’ 화면은 다음 단계에서 만들어요.`),

  'set-tone': (el) => { compose.tone = el.dataset.tone; compose.copied = false; render(); },
  'close-compose': closeCompose,
  'copy-mail': async () => {
    const today = currentToday();
    const item = withDays(state.items.find((x) => x.id === compose.itemId), today);
    const mail = buildMail({
      item, person: state.people[item.owner], client: state.client,
      manager: state.team?.manager, today, tone: compose.tone,
    });
    if (!(await copyText(mailToText(mail)))) {
      toast('복사하지 못했어요. 미리보기에서 직접 선택해 복사해 주세요.');
      return;
    }
    state = recordNudge(state, item.id, compose.tone, today);
    save(state);
    compose.copied = true;
    compose.toast = true;
    render();
    clearTimeout(composeToastTimer);
    composeToastTimer = setTimeout(() => { if (compose) { compose.toast = false; render(); } }, 2800);
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
  if (e.key === 'Escape' && compose) closeCompose();
});

// 개발용: 콘솔에서 pbc.reset() 하면 첫 실행 화면으로 돌아간다.
window.pbc = { reset() { clear(); state = null; compose = null; render(); } };

render();
