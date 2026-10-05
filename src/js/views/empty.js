// 8. 빈 상태 · 첫 실행 — 레퍼런스 8
// 예시 자료로 시작하거나, 클라이언트명·감사명을 넣고 직접 시작한다.

import { esc } from './html.js';

/**
 * @param form { clientName, engagement, myName, myTitle, members, manager, errors }
 */
export function renderEmpty({ clientName = '', engagement = '', myName = '', myTitle = '', members = '', manager = '', errors = {} } = {}) {
  return `
    <div class="page empty">
      <header class="topbar">
        <div class="brand"><span class="brand-mark" aria-hidden="true"></span>PBC Mate</div>
        <span class="chip">클라이언트 이름을 정해주세요</span>
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
          <label class="f ${errors.clientName ? 'has-error' : ''}">
            <span class="f-label">클라이언트명</span>
            <input type="text" name="clientName" value="${esc(clientName)}" placeholder="예: ㈜한빛전자" autocomplete="organization">
            ${errors.clientName ? `<span class="f-error">${esc(errors.clientName)}</span>` : ''}
          </label>
          <label class="f ${errors.engagement ? 'has-error' : ''}">
            <span class="f-label">감사명</span>
            <input type="text" name="engagement" value="${esc(engagement)}" placeholder="예: 2026 기말감사" autocomplete="off">
            ${errors.engagement ? `<span class="f-error">${esc(errors.engagement)}</span>` : ''}
          </label>
          <div class="empty-team-title">감사팀 <small>요청 감사인과 메일 서명에 쓰여요</small></div>
          <label class="f ${errors.myName ? 'has-error' : ''}">
            <span class="f-label">내 이름</span>
            <input type="text" name="myName" value="${esc(myName)}" placeholder="예: 장재혁" autocomplete="name">
            ${errors.myName ? `<span class="f-error">${esc(errors.myName)}</span>` : ''}
          </label>
          <label class="f">
            <span class="f-label">직급 <small>선택</small></span>
            <input type="text" name="myTitle" value="${esc(myTitle)}" placeholder="예: 회계사" autocomplete="off">
          </label>
          <label class="f">
            <span class="f-label">팀원 <small>선택 · 쉼표로 구분</small></span>
            <input type="text" name="members" value="${esc(members)}" placeholder="예: 김서윤 회계사, 박도윤 회계사" autocomplete="off">
          </label>
          <label class="f">
            <span class="f-label">담당 매니저 <small>선택 · 매니저 참조 메일의 참조</small></span>
            <input type="text" name="manager" value="${esc(manager)}" placeholder="예: 이서연 매니저" autocomplete="off">
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

function step(n, title, desc) {
  return `
    <div class="step">
      <div class="step-num">${n}</div>
      <div><div class="step-title">${title}</div><div class="step-desc">${desc}</div></div>
    </div>`;
}
