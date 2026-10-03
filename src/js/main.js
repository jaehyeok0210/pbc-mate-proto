// 진입점: 상태를 불러와 화면을 그리고, data-action 클릭을 처리한다.

import { todayISO } from './lib/dates.js';
import { load, save, clear, sampleState, baseDateOf } from './store.js';
import { renderDashboard } from './views/dashboard.js';
import { renderEmpty } from './views/empty.js';

// ?today=2026-10-01 처럼 기준일을 직접 지정해 확인할 수 있다.
const todayParam = new URLSearchParams(location.search).get('today');

const app = document.getElementById('app');
let state = load();
let mode = 'need';

function render() {
  if (!state) { app.innerHTML = renderEmpty(); return; }
  const today = baseDateOf(state, todayParam, todayISO());
  const isDemo = !todayParam && Boolean(state.demoDate);
  app.innerHTML = renderDashboard(state, { today, mode, isDemo });
}

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

const actions = {
  'set-mode': (el) => { mode = el.dataset.mode; render(); },
  'load-sample': () => { state = sampleState(); save(state); render(); },
  todo: (el) => toast(`‘${el.dataset.what}’ 화면은 다음 단계에서 만들어요.`),
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  actions[el.dataset.action]?.(el);
});

// 개발용: 콘솔에서 pbc.reset() 하면 첫 실행 화면으로 돌아간다.
window.pbc = { reset() { clear(); state = null; render(); } };

render();
