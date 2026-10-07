// 7. 주간 현황 보고 — 레퍼런스 7
// 대시보드와 같은 상단바 아래에 요약 카드(왼쪽)와 담당자별 현황·자료 목록(오른쪽)을 보여준다.

import { formatMD, formatMDW } from '../lib/dates.js';
import { leftText } from '../lib/priority.js';
import { weekLabel, summaryLines, filterRows, groupRowsByDoc } from '../lib/report.js';
import { esc, ICON, STATUS_LABEL } from './html.js';
import { topbar } from './dashboard.js';
import { confirmOverview } from './overview.js';
import { trackOverview } from '../lib/followup.js';
import { attachCell } from './attach.js';
import { requesterSummary, requesterMembers, currentUser, requesterOpenItems } from '../lib/team.js';

/**
 * @param state  앱 상태
 * @param report buildReport() 결과
 * @param opts   { today, isDemo, query }  query: 자료 목록 검색어
 */
export function renderReport(state, report, { today, isDemo, query = '', openRequesters = new Set(), listView = { view: 'list', open: new Set() } }) {
  const { counts, received, owners, rows } = report;
  const lines = summaryLines(report);

  return `
    <div class="page report">
      ${topbar(state.client, today, isDemo, 'report', state.team)}

      <section class="report-head">
        <div>
          <div class="report-week">${weekLabel(report.week)}</div>
          <h1>주간 현황 보고 <span>· 받은 것 · 남은 것 · 지연을 감사팀 안에서 공유해요</span></h1>
        </div>
        ${counts.total ? `
          <div class="report-actions">
            <button type="button" class="btn btn-sub" data-action="download-csv">${ICON.download}CSV로 내려받기</button>
            <button type="button" class="btn btn-cta" data-action="copy-report">${ICON.copy}현황 복사</button>
          </div>` : ''}
      </section>

      ${counts.total ? body(report, lines, state, query, openRequesters, listView) : empty()}
    </div>`;
}

function body(report, lines, state, query, openRequesters, listView) {
  const { counts, received, owners, rows } = report;
  return `
    <div class="report-grid">
      <aside class="report-side">
        <div class="stat-grid">
          ${stat('전체 자료', counts.total, `완료 ${counts.done} · 미완료 ${counts.open}`)}
          ${stat('완료', counts.done, '')}
          ${stat('미회신', counts.none, '')}
          ${stat('일부 수령', counts.part, '')}
          ${stat('보완 요청', counts.fix, '', counts.fix ? 'is-fix' : '')}
          ${counts.follow ? stat('후속 절차', counts.follow, '외부조회 미회수·차이', 'is-follow') : ''}
          ${stat('지연', counts.late, counts.urgent ? `2일 이내 포함 ${counts.urgent}건` : '', `${counts.late ? 'is-late' : ''} ${counts.follow ? 'stat-span' : ''}`)}
        </div>
        <div class="stat stat-wide">
          <div class="stat-label">이번 주 수령</div>
          <div class="stat-value">${received.count}건</div>
          <div class="stat-sub">${received.items.length
            ? received.items.map((x) => `${esc(x.name)} (${formatMD(x.received.on)})`).join(' · ')
            : '수령일이 기록된 자료가 없어요'}${received.missingDates ? ` · 수령일 없는 ${received.missingDates}건은 제외` : ''}</div>
        </div>
        <div class="report-summary">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
      </aside>

      <section class="report-main">
        ${confirmOverview(trackOverview(state.items, state.materiality?.performance), state.materiality)}

        <div class="report-block">
          <h2>담당자별(거래처별) 현황 <span>· 담당자를 누르면 상세를 볼 수 있어요</span></h2>
          <div class="owner-table">
            <div class="ot-row ot-head"><div>담당자</div><div>미완료</div><div>긴급·지연</div><div>가장 가까운 필요일</div><div>최근 요청</div></div>
            ${owners.map((o) => `
              <div class="ot-row">
                <div class="ot-owner"><a class="owner-link" href="#/owner/${encodeURIComponent(o.owner)}">${esc(o.owner)}${ICON.chevron}</a>${o.dept ? `<small>${esc(o.dept)}</small>` : ''}</div>
                <div><b>${o.open}건</b></div>
                <div class="${o.urgent ? 'is-urgent' : ''}">${o.urgent ? `${o.urgent}건` : '—'}</div>
                <div>${formatMDW(o.nearest)} <small>· ${leftText(o.nearestLeft)}</small></div>
                <div>${o.lastNudgedOn ? formatMD(o.lastNudgedOn) : '—'}</div>
              </div>`).join('')}
          </div>
        </div>

        ${requesterBlock(report.rows, requesterMembers(state), currentUser(state), openRequesters)}

        <div class="report-block">
          <div class="it-headline">
            <h2>자료 목록 <span>· 필요일이 가까운 순 · 완료는 맨 아래</span></h2>
            <div class="seg it-view" role="group" aria-label="자료 목록 보기">
              <button type="button" data-action="report-view" data-view="list" aria-pressed="${listView.view !== 'doc'}">전체 목록</button>
              <button type="button" data-action="report-view" data-view="doc" aria-pressed="${listView.view === 'doc'}">문서종류별</button>
            </div>
            <label class="it-search">
              ${ICON.search}
              <input type="search" data-action-input="report-search" value="${esc(query)}" placeholder="자료명 검색" aria-label="자료명 검색" autocomplete="off">
            </label>
          </div>
          <div class="item-table">${itemTableBody(rows, query, listView)}</div>
        </div>
      </section>
    </div>`;
}

/** 감사인별 현황: 팀원마다 요청 중·긴급·완료. 이름을 누르면 대시보드를 그 감사인 자료로 좁혀 연다. */
function requesterBlock(rows, members, me, openKeys) {
  if (!members.length) return '';
  const list = requesterSummary(rows, members);
  return `
        <div class="report-block">
          <h2>감사인별 현황 <span>· 이름을 누르면 요청 중인 자료를 펼쳐 봐요</span></h2>
          <div class="owner-table req-table">
            <div class="ot-row ot-head"><div>요청 감사인</div><div>요청 중</div><div>긴급·지연</div><div>완료</div><div>가장 가까운 필요일</div></div>
            ${list.map((r) => {
              const open = openKeys.has(r.key);
              return `
              <div class="ot-row ${r.key && r.key === me ? 'is-me' : ''} ${open ? 'is-open' : ''}">
                <div class="ot-owner"><button type="button" class="owner-link req-toggle" data-action="toggle-requester" data-who="${esc(r.key)}" aria-expanded="${open}">${ICON.chevron}${esc(r.name)}</button>${r.key && r.key === me ? '<span class="me-tag">나</span>' : ''}</div>
                <div><b>${r.open}건</b></div>
                <div class="${r.urgent ? 'is-urgent' : ''}">${r.urgent ? `${r.urgent}건` : '—'}</div>
                <div>${r.done ? `${r.done}건` : '—'}</div>
                <div>${r.nearest ? `${formatMDW(r.nearest.neededOn)} <small>· ${leftText(r.nearest.left)}</small>` : '—'}</div>
              </div>
              ${open ? requesterItems(requesterOpenItems(rows, r.key)) : ''}`;
            }).join('')}
          </div>
        </div>`;
}

// 펼친 감사인의 요청 중인 자료: 누르면 그 자료의 요청 메일(보완 요청·후속 절차) 화면을 연다. 닫으면 주간 보고로 돌아온다.
function requesterItems(items) {
  if (!items.length) return '<div class="req-items is-empty">요청 중인 자료가 없어요.</div>';
  const href = (r) => (r.status === 'follow' ? `#/follow/${encodeURIComponent(r.id)}`
    : r.status === 'fix' ? `#/fix/${encodeURIComponent(r.id)}` : `#/compose/${encodeURIComponent(r.id)}`);
  return `
              <ul class="req-items">
                ${items.map((r) => `
                <li>
                  <a class="req-item-name" href="${href(r)}" data-return="#/report">${esc(r.name)}</a>
                  <span class="req-item-owner">${esc(r.owner)}</span>
                  <span class="status status-${r.status}">${ICON[r.status]}${STATUS_LABEL[r.status]}</span>
                  <span class="req-item-due">${formatMD(r.neededOn)} · <b class="risk-text risk-${r.risk}">${leftText(r.left)}</b></span>
                </li>`).join('')}
              </ul>`;
}

/**
 * 자료 목록 표 내용. 검색어를 칠 때 이 부분만 다시 그린다 (입력 포커스 유지).
 * listView.view 'doc'이면 문서종류별로 묶고, 작은 묶음을 눌러 펼친다. 검색 중에는 찾은 묶음을 모두 펼친다.
 */
export function itemTableBody(allRows, query, listView = { view: 'list', open: new Set() }) {
  const rows = filterRows(allRows, query);
  const head = '<div class="it-row it-head"><div>자료명</div><div>담당자</div><div>상태</div><div>필요일</div><div>남은 날</div><div>최근 요청</div><div>첨부자료</div></div>';
  const count = query ? `<div class="it-count">‘${esc(query)}’ 검색 결과 ${rows.length}건 / 전체 ${allRows.length}건</div>` : '';
  if (!rows.length) return `${head}${count}<div class="it-empty">검색 결과가 없어요. 자료명의 일부만 입력해 보세요.</div>`;
  if (listView.view !== 'doc') return `${head}${count}${rows.map(itemRow).join('')}`;

  const sumText = (m) => `${m.total}건 · 완료 ${m.done}${m.urgent ? ` · <b class="is-urgent">긴급 ${m.urgent}</b>` : ''}`;
  return `${head}${count}${groupRowsByDoc(rows).map((g) => `
            <div class="doc-group"><b>${esc(g.label)}</b><small>${sumText(g.summary)}</small></div>
            ${g.subs.map((sub) => {
              const open = Boolean(query) || listView.open.has(sub.id);
              return `
            <button type="button" class="doc-sub" data-action="toggle-doc" data-doc="${esc(sub.id)}" aria-expanded="${open}">
              ${ICON.chevron}<span>${esc(sub.label)}</span><small>${sumText(sub.summary)}</small>
            </button>
            ${open ? `<div class="doc-rows">${sub.rows.map(itemRow).join('')}</div>` : ''}`;
            }).join('')}`).join('')}`;
}

function itemRow(r) {
  return `
              <div class="it-row ${r.status === 'done' ? 'is-done' : ''}">
                <div class="it-name">${esc(r.name)}${r.fixReason ? `<small>${esc(r.fixReason)}</small>` : ''}${r.signoff ? `<small>${esc(r.signoff)}</small>` : ''}</div>
                <div><a class="owner-link is-plain" href="#/owner/${encodeURIComponent(r.owner)}">${esc(r.owner)}</a>${r.requester ? `<small class="it-req">요청 ${esc(r.requester)}</small>` : ''}</div>
                <div><span class="status status-${r.status}">${ICON[r.status]}${STATUS_LABEL[r.status]}</span>${r.status === 'done' ? `<button type="button" class="it-revert" data-action="open-status" data-item="${esc(r.id)}" title="잘못 완료했거나 받은 자료가 무효이면 사유를 적고 되돌려요">되돌리기</button>` : ''}</div>
                <div>${formatMD(r.neededOn)}</div>
                <div class="it-left">${r.status === 'done' ? '—' : `<b>${leftText(r.left)}</b><span class="risk risk-${r.risk}">${ICON[r.risk]}${r.riskLabel}</span>`}</div>
                <div>${r.lastNudgedOn ? formatMD(r.lastNudgedOn) : '—'}</div>
                <div class="it-att">${attachCell(r)}</div>
              </div>`;
}

function stat(label, value, sub, cls = '') {
  return `
    <div class="stat ${cls}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}건</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
    </div>`;
}

function empty() {
  return `
    <section class="report-empty">
      <p>아직 집계할 자료가 없어요.</p>
      <div>
        <a class="btn btn-cta" href="#/add">자료 추가</a>
        <a class="btn btn-sub" href="#">대시보드로</a>
      </div>
    </section>`;
}
