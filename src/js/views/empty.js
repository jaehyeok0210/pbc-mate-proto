// 8. 빈 상태 · 첫 실행 — 레퍼런스 8
// 예시 자료로 시작하거나, 클라이언트를 조회해 감사 계약을 고르고 내 이름을 넣어 직접 시작한다.

import { engagementById } from '../lib/engagements.js';
import { esc, ICON } from './html.js';

/**
 * @param form { query, results: 조회 결과 | null(조회 전), selectedId, myName, myTitle, errors }
 */
export function renderEmpty({ query = '', results = null, selectedId = null, myName = '', myTitle = '', errors = {} } = {}) {
  const picked = engagementById(selectedId);
  return `
    <div class="page empty">
      <header class="topbar">
        <div class="brand"><span class="brand-mark" aria-hidden="true"></span>PBC Mate</div>
        <span class="chip">${picked ? `${esc(picked.client)} · ${esc(picked.engagement)}` : '클라이언트를 조회해 주세요'}</span>
      </header>

      <main class="empty-main">
        <div class="empty-art" aria-hidden="true">
          <span class="ea-box" style="left:15%"></span>
          <span class="ea-box" style="left:57%"></span>
          <span class="ea-seg risk-high" style="left:0;width:16%"></span>
          <span class="ea-seg risk-mid" style="left:16%;width:34%"></span>
          <span class="ea-seg risk-low" style="left:50%;right:0"></span>
          <span class="tl-now"></span>
          <span class="ea-today">오늘</span>
        </div>
        <h1>요청한 자료를 필요일 기준으로 챙겨드려요</h1>
        <p>자료마다 필요일을 넣으면 남은 날로 급한 순서를 정하고, 재촉 메일 초안까지 만들어요.</p>

        <form class="empty-form" id="engagement-form" novalidate>
          <div class="f eng-lookup ${errors.client ? 'has-error' : ''}">
            <span class="f-label">클라이언트명 <small>조회하면 감사명·팀원·담당 매니저가 채워져요</small></span>
            <div class="eng-search">
              <input type="text" name="clientQuery" value="${esc(query)}" placeholder="예: 한빛전자" autocomplete="off" data-enter="eng-search">
              <button type="button" class="btn btn-sub" data-action="eng-search">조회하기</button>
            </div>
            ${errors.client ? `<span class="f-error">${esc(errors.client)}</span>` : ''}
          </div>
          ${picked ? pickedCard(picked) : resultList(results, query)}

          <label class="f ${errors.myName ? 'has-error' : ''}">
            <span class="f-label">내 이름</span>
            <input type="text" name="myName" value="${esc(myName)}" placeholder="예: 장재혁" autocomplete="name">
            ${errors.myName ? `<span class="f-error">${esc(errors.myName)}</span>` : ''}
          </label>
          <label class="f">
            <span class="f-label">직급 <small>선택</small></span>
            <input type="text" name="myTitle" value="${esc(myTitle)}" placeholder="예: 회계사" autocomplete="off">
          </label>
        </form>

        <div class="empty-actions">
          <button type="button" class="btn btn-cta" data-action="load-sample">예시 자료로 시작</button>
          <button type="button" class="btn btn-sub" data-action="start-blank" data-target="add">직접 추가</button>
        </div>
        <button type="button" class="link" data-action="start-blank" data-target="paste">엑셀에서 요청 목록 붙여넣기</button>
      </main>

      <section class="steps">
        ${step(1, '자료와 필요일 넣기', '감사 절차를 연결하면 그 시작일이 필요일이 돼요.')}
        ${step(2, '남은 날로 위험도 확인', '2일 이내 · 3~7일 · 8일 이상으로 나눠 보여드려요.')}
        ${step(3, '초안 복사해 아웃룩에', '담당자별로 묶고, 톤을 고른 뒤 복사만 하면 돼요.')}
      </section>
    </div>`;
}

// 조회 결과: 감사 계약마다 감사명·매니저·팀원
function resultList(results, query) {
  if (results === null) return '';
  if (!results.length) {
    return `<div class="eng-results is-empty">‘${esc(query)}’로 조회된 감사 계약이 없어요. 회사 이름의 일부만 넣어 보세요.</div>`;
  }
  return `
    <div class="eng-results" role="listbox" aria-label="조회된 감사 계약">
      ${results.map((e) => `
        <button type="button" class="eng-item" data-action="eng-pick" data-id="${esc(e.id)}" role="option">
          <span class="eng-name"><b>${esc(e.client)}</b> · ${esc(e.engagement)}</span>
          <small>담당 매니저 ${esc(e.manager)} · 팀원 ${e.members.map(esc).join(', ')}</small>
        </button>`).join('')}
    </div>`;
}

// 고른 감사 계약: 자동으로 채워진 값
function pickedCard(e) {
  return `
    <div class="eng-picked">
      <dl>
        <div><dt>클라이언트</dt><dd>${esc(e.client)}</dd></div>
        <div><dt>감사명</dt><dd>${esc(e.engagement)}</dd></div>
        <div><dt>담당 매니저</dt><dd>${esc(e.manager)}</dd></div>
        <div><dt>팀원</dt><dd>${e.members.map(esc).join(', ')}</dd></div>
      </dl>
      <button type="button" class="link" data-action="eng-clear">다시 조회</button>
    </div>`;
}

function step(n, title, desc) {
  return `
    <div class="step">
      <div class="step-num">${n}</div>
      <div><div class="step-title">${title}</div><div class="step-desc">${desc}</div></div>
    </div>`;
}
