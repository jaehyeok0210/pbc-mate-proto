// 자료 상태 변경: 요청 → 요청 → 수령 뒤에 사용자가 상태를 직접 갱신한다.
// 상태 체계는 그대로(none · part · fix · done). 역방향 전환은 막는다.

import { FIX_REASONS, fixSummary } from './fix.js';

/** 현재 상태에서 바꿀 수 있는 상태 */
export const ALLOWED_TRANSITIONS = {
  none: ['part', 'fix', 'done'],
  part: ['fix', 'done'],
  fix: ['part', 'done'],
  done: [],
};

export const STATUS_HINT = {
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
 * - 일부 수령·보완 요청·완료로 처음 바뀔 때 received.on = on. 이미 있으면 최초 수령일 유지.
 * - 보완 요청이면 fix.reason(·기준일)을 저장하고 대시보드용 요약(reason)을 fixSummary로 만든다.
 * - 요청 이력(nudges)·보완 이력(fixes)은 건드리지 않는다.
 */
export function transitionItem(item, change, on) {
  const errors = validateTransition(item, change);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);

  const received = { ...(item.received || {}), on: item.received?.on || on };
  if (change.status === 'fix' && change.reason === 'date') received.basisDate = change.basisDate;

  const next = { ...item, status: change.status, received };

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
