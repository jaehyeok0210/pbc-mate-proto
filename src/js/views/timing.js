// 발송 시점 안내 — 레퍼런스 5. 단건·묶음 요청 화면이 함께 쓴다.

import { ICON } from './html.js';

/** 현재 시각 칩. 일반 시간이면 '지금 보내도 괜찮아요'까지 칩 안에 쓴다. */
export function timingChip(t) {
  return `<span class="clock-chip">${ICON.clock}${t.nowLabel}${t.kind === 'ok' ? ` · ${t.title}` : ''}</span>`;
}

/** 금요일 늦은 시간·주말일 때만 보이는 안내 배너. 일반 시간에는 아무것도 그리지 않는다. */
export function timingBanner(t) {
  if (t.kind === 'ok') return '';
  const chips = t.chips.map((c) =>
    `<span><span class="tb-chip-label">${c.label}</span> <b>${c.value}</b>${c.extra ? ` · ${c.extra}` : ''}</span>`).join('');
  // 미루기 추천일 때만: 앱이 예약 발송을 하지 않는다는 점을 이유 뒤에 한 문장으로 덧붙인다.
  const note = t.kind === 'wait' ? ' 예약 발송은 하지 않아요.' : '';

  return `
    <div class="timing-banner is-${t.kind}" role="status">
      <span class="tb-icon">${t.kind === 'wait' ? ICON.moon : ICON.high}</span>
      <div class="tb-text">
        <b>${t.title}</b>
        ${t.recommend ? `<span class="tb-recommend">${t.recommend}</span>` : ''}
        <small>${t.reason}${note}</small>
      </div>
      <div class="tb-chips">${chips}</div>
    </div>`;
}
