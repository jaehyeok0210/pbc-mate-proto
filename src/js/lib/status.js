// 자료 상태 변경: 요청 → 수령 뒤에 사용자가 상태를 직접 갱신한다.
// 상태 체계는 그대로(none · part · fix · done).
// - 완료는 받은 자료(첨부)가 있어야 한다 (감사증거 없이 완료 처리 금지).
// - 잘못 처리한 상태는 되돌릴 수 있되, 사유를 적어야 하고 이전 상태·수령 기록은 이력(statusLog)에 남는다.

import { FIX_REASONS, fixSummary } from './fix.js';

/** 현재 상태에서 바꿀 수 있는 상태 */
export const ALLOWED_TRANSITIONS = {
  none: ['part', 'fix', 'done'],
  part: ['none', 'fix', 'done'],
  fix: ['none', 'part', 'done'],
  done: ['none', 'part', 'fix'],
};

/** 정정(되돌리기): 미회신으로 되돌리거나, 완료를 다시 여는 것. 사유가 필요하다. */
export function isCorrection(item, status) {
  return status === 'none' || item.status === 'done';
}

/** 완료에 필요한 증거: 받은 파일이 하나 이상 첨부돼 있어야 한다 */
export function hasEvidence(item) {
  return (item.attachments || []).length > 0;
}

export const STATUS_HINT = {
  none: '받은 자료가 무효이거나 잘못 처리했어요 · 다시 요청해요',
  part: '일부만 받았고 나머지는 계속 요청해요',
  fix: '받았지만 그대로 쓸 수 없어 다시 요청해요',
  done: '필요한 자료를 모두 받았어요',
};

export function allowedStatuses(item) {
  return ALLOWED_TRANSITIONS[item.status] || [];
}

export function canTransition(item, status) {
  return allowedStatuses(item).includes(status);
}

/**
 * 변경 내용 검증. change: { status, reason?, basisDate?, requiredBasisDate? }
 * @returns {Record<string,string>} 비어 있으면 통과
 */
export function validateTransition(item, change) {
  const errors = {};
  if (!canTransition(item, change.status)) errors.status = '지금 상태에서는 바꿀 수 없어요.';
  if (change.status === 'done' && !hasEvidence(item)) errors.evidence = '완료하려면 받은 자료를 첨부해야 해요.';
  if (isCorrection(item, change.status) && !String(change.note || '').trim()) errors.note = '되돌리는 사유를 적어 주세요.';
  if (change.status === 'fix') {
    if (!FIX_REASONS.some((r) => r.key === change.reason)) errors.reason = '보완 사유를 골라 주세요.';
    if (change.reason === 'date') {
      if (!change.basisDate) errors.basisDate = '받은 자료의 기준일을 입력해 주세요.';
      if (!change.requiredBasisDate) errors.requiredBasisDate = '필요한 기준일을 입력해 주세요.';
    }
  }
  return errors;
}

/**
 * 상태를 바꾼 새 자료를 돌려준다. 원래 자료는 바꾸지 않는다.
 * - 모든 변경은 statusLog에 { on, from, to, by?, note? }로 남는다.
 * - 미회신으로 되돌리면 현재 수령 기록(received)·보완 사유를 비우되, 이전 수령 기록은 로그에 함께 남긴다.
 * - 일부 수령·보완 요청·완료로 처음 바뀔 때 received.on = on. 이미 있으면 최초 수령일 유지.
 * - 보완 요청이면 fix.reason(·기준일)을 저장하고 대시보드용 요약(reason)을 fixSummary로 만든다.
 * - 요청 이력(nudges)·보완 이력(fixes)은 건드리지 않는다.
 */
export function transitionItem(item, change, on) {
  const errors = validateTransition(item, change);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);

  const log = { on, from: item.status, to: change.status };
  if (change.by) log.by = change.by;
  if (String(change.note || '').trim()) log.note = change.note.trim();
  const statusLog = [...(item.statusLog || []), log];

  if (change.status === 'none') {
    if (item.received) log.received = item.received;
    const next = { ...item, status: 'none', statusLog };
    delete next.received;
    delete next.reason;
    delete next.fix;
    return next;
  }

  const received = { ...(item.received || {}), on: item.received?.on || on };
  if (change.status === 'fix' && change.reason === 'date') received.basisDate = change.basisDate;

  const next = { ...item, status: change.status, received, statusLog };

  if (change.status === 'fix') {
    next.fix = {
      ...(item.fix || {}),
      reason: change.reason,
      ...(change.reason === 'date' && { requiredBasisDate: change.requiredBasisDate }),
    };
    next.reason = fixSummary(next, change.reason);
  } else if ('reason' in next && item.status === 'fix') {
    // 보완 요청에서 벗어나면 대시보드 한 줄 요약은 지운다. 이력(fixes)은 남는다.
    delete next.reason;
  }
  return next;
}
