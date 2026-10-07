// 자료 상태 변경 시트 — 단건 요청·보완 요청 화면 위에 작게 뜬다.

import { formatMD } from '../lib/dates.js';
import { allowedStatuses, STATUS_HINT, isCorrection, hasEvidence } from '../lib/status.js';
import { FIX_REASONS } from '../lib/fix.js';
import { templateOf, receiptSuggestion } from '../lib/pbcTemplate.js';
import { esc, ICON, STATUS_LABEL } from './html.js';

/**
 * @param item  상태를 바꿀 자료
 * @param sheet { status, reason, basisDate, requiredBasisDate, errors }
 * @param today 기준일 (수령일로 기록될 날짜)
 */
export function renderStatusSheet(item, { status, reason, basisDate, requiredBasisDate, note: correction = '', errors, check }, today) {
  const options = allowedStatuses(item).map((s) => `
    <button type="button" class="status-opt" data-action="pick-status" data-status="${s}" aria-pressed="${status === s}">
      <span class="status status-${s}">${ICON[s]}${STATUS_LABEL[s]}</span>
      <small>${STATUS_HINT[s]}</small>
    </button>`).join('');

  const receivedNote = status === 'none'
    ? '지금 수령 기록은 비워지고, 이전 기록은 변경 이력에 남아요.'
    : item.received?.on
      ? `수령일은 처음 받은 ${formatMD(item.received.on)} 그대로예요.`
      : `수령일이 ${formatMD(today)}로 기록돼요.`;
  const note = status
    ? `${receivedNote} 요청 횟수와 이력은 바뀌지 않아요.`
    : '바꿀 상태를 골라 주세요. 잘못 처리한 상태는 사유를 적고 되돌릴 수 있어요.';
  const correcting = status && isCorrection(item, status);
  const needsFile = status === 'done' && !hasEvidence(item);

  return `
    <div class="sheet-dim" data-action="close-status"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="status-title">
      <div class="sheet-head">
        <div>
          <div class="eyebrow">자료 상태 변경</div>
          <h3 id="status-title">${esc(item.name)}</h3>
          <div class="sheet-current">지금 <span class="status status-${item.status}">${ICON[item.status]}${STATUS_LABEL[item.status]}</span></div>
        </div>
        <button type="button" class="icon-btn btn-sub" data-action="close-status" aria-label="닫기">${ICON.close}</button>
      </div>

      <div class="sheet-body">
        ${receiptCheck(item, check, today)}
        <div class="status-opts">${options}</div>
        ${errors.status ? `<div class="f-error">${esc(errors.status)}</div>` : ''}
        ${status === 'fix' ? fixFields(reason, basisDate, requiredBasisDate, errors) : ''}
        ${correcting ? correctionField(correction, errors) : ''}
        ${needsFile ? `<div class="sheet-evidence">${ICON.file}<span><b>완료하려면 받은 자료를 첨부해야 해요.</b> 다음 단계에서 파일을 고르면 첨부와 함께 완료로 처리돼요.</span></div>` : ''}
        <div class="sheet-note">${note}</div>
        ${historyList(item)}
      </div>

      <footer class="sheet-foot">
        <button type="button" class="btn btn-sub" data-action="close-status">취소</button>
        <button type="button" class="btn btn-cta" data-action="save-status" ${status ? '' : 'disabled'}>${needsFile ? '받은 자료 첨부하고 완료' : saveLabel(status, correcting)}</button>
      </footer>
    </div>`;
}

// 표준 양식으로 요청한 자료: 받은 자료를 양식 기준으로 점검하면 상태와 보완 사유를 추천한다.
function receiptCheck(item, check, today) {
  const t = templateOf(item);
  if (!t || !check) return '';
  const basis = item.basisDate || `${today.slice(0, 4)}-12-31`;
  const s = receiptSuggestion(t, check, basis);
  const yesNo = (action, value, yes, no) => `
    <span class="rc-yn">
      <button type="button" data-action="${action}" data-ok="1" aria-pressed="${value === true}">${yes}</button>
      <button type="button" data-action="${action}" data-ok="0" aria-pressed="${value === false}">${no}</button>
    </span>`;
  return `
    <section class="receipt-check">
      <div class="f-label">받은 자료 점검 <small>${esc(t.name)} 표준 양식 기준</small></div>
      <div class="rc-row"><span>기준일이 <b>${basis.replaceAll('-', '.')}</b>인가요?</span>${yesNo('check-basis', check.basisOk, '맞아요', '달라요')}</div>
      <div class="rc-row rc-cols"><span>빠진 항목을 눌러 표시해 주세요</span>
        <div class="tpl-cols">${t.columns.map((c) => `<button type="button" data-action="check-col" data-col="${esc(c)}" aria-pressed="${check.missing.includes(c)}">${esc(c)}</button>`).join('')}</div>
      </div>
      ${t.sign ? `<div class="rc-row"><span>${esc(t.sign)}에 서명이 있나요?</span>${yesNo('check-sign', check.signOk, '있어요', '없어요')}</div>` : ''}
      <div class="rc-result ${s.status === 'fix' ? 'is-fix' : s.status === 'done' ? 'is-done' : ''}">${esc(s.summary)}</div>
    </section>`;
}

// 정정(되돌리기) 사유: 기존 기록은 덮어쓰지 않고 변경 이력에 남는다
function correctionField(value, errors) {
  return `
    <label class="f ${errors.note ? 'has-error' : ''}">
      <span class="f-label">되돌리는 사유 <small>필수 · 변경 이력에 남아요</small></span>
      <input type="text" name="statusNote" value="${esc(value)}" placeholder="예: 받은 파일이 다른 회사 자료였음" autocomplete="off">
      ${errors.note ? `<span class="f-error">${esc(errors.note)}</span>` : ''}
    </label>`;
}

// 변경 이력 (최근 3건)
function historyList(item) {
  const log = item.statusLog || [];
  if (!log.length) return '';
  const rows = log.slice(-3).reverse().map((l) => `
    <li><span>${formatMD(l.on)}</span><span>${STATUS_LABEL[l.from] || l.from} → ${STATUS_LABEL[l.to] || l.to}</span>
      <small>${[l.by, l.note].filter(Boolean).map(esc).join(' · ')}</small></li>`).join('');
  return `<div class="status-log"><div class="f-label">변경 이력 <small>${log.length}건</small></div><ul>${rows}</ul></div>`;
}

function saveLabel(status, correcting) {
  if (correcting) return status === 'none' ? '미회신으로 되돌리기' : `${STATUS_LABEL[status]}(으)로 정정`;
  if (status === 'done') return '완료로 처리';
  if (status === 'fix') return '보완 요청으로 저장';
  if (status === 'part') return '일부 수령으로 저장';
  return '저장';
}

// 보완 요청을 고르면 사유를, 기준일 상이면 두 기준일까지 같이 받는다.
function fixFields(reason, basisDate, requiredBasisDate, errors) {
  const reasons = FIX_REASONS.map((r) => `
    <button type="button" class="reason-btn" data-action="pick-fix-reason" data-reason="${r.key}" aria-pressed="${reason === r.key}">
      <b>${r.label}</b><small>${r.hint}</small>
    </button>`).join('');

  const dates = reason === 'date' ? `
    <div class="basis-inputs">
      <label class="f ${errors.basisDate ? 'has-error' : ''}">
        <span class="f-label">받은 자료 기준일</span>
        <input type="date" name="basisDate" value="${esc(basisDate || '')}">
        ${errors.basisDate ? `<span class="f-error">${esc(errors.basisDate)}</span>` : ''}
      </label>
      <span class="basis-arrow">${ICON.arrow}</span>
      <label class="f ${errors.requiredBasisDate ? 'has-error' : ''}">
        <span class="f-label">필요한 기준일</span>
        <input type="date" name="requiredBasisDate" value="${esc(requiredBasisDate || '')}">
        ${errors.requiredBasisDate ? `<span class="f-error">${esc(errors.requiredBasisDate)}</span>` : ''}
      </label>
    </div>` : '';

  return `
    <div class="sheet-fix">
      <div class="f-label">무엇을 다시 받아야 하나요?</div>
      <div class="reason-grid" role="group" aria-label="보완 사유">${reasons}</div>
      ${errors.reason ? `<div class="f-error">${esc(errors.reason)}</div>` : ''}
      ${dates}
    </div>`;
}
