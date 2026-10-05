// 완료 처리 후 뜨는 파일 첨부 창. 주간 보고의 '+ 첨부'로도 연다.

import { formatSize, MAX_FILE_BYTES } from '../lib/attach.js';
import { esc, ICON } from './html.js';

/**
 * @param item  첨부할 자료
 * @param view  { pending: File[], rejected: { name, reason }[], justDone: boolean, saving: boolean }
 */
export function renderAttach(item, { pending, rejected, justDone, saving }) {
  const existing = item.attachments || [];
  return `
    <div class="sheet-dim" data-action="attach-close"></div>
    <div class="sheet attach" role="dialog" aria-modal="true" aria-labelledby="attach-title">
      <div class="sheet-head">
        <div>
          <div class="eyebrow">${justDone ? '완료 처리했어요 · 받은 파일을 남겨 두세요' : '첨부자료'}</div>
          <h3 id="attach-title">${esc(item.name)}</h3>
          <div class="sheet-current">${esc(item.owner)}${existing.length ? ` · 이미 ${existing.length}개 첨부` : ''}</div>
        </div>
        <button type="button" class="icon-btn btn-sub" data-action="attach-close" aria-label="닫기">${ICON.close}</button>
      </div>

      <div class="sheet-body">
        <label class="attach-drop" for="attach-input">
          ${ICON.download}
          <b>파일을 끌어다 놓거나 눌러서 고르세요</b>
          <small>여러 개 가능 · 한 파일 ${formatSize(MAX_FILE_BYTES)}까지 · PDF, 엑셀, 이미지 등</small>
          <input id="attach-input" type="file" multiple data-action-change="attach-pick" hidden>
        </label>

        ${pending.length ? `
          <ul class="attach-list">
            ${pending.map((f, i) => `
              <li><span class="attach-name">${esc(f.name)}</span><small>${formatSize(f.size)}</small>
                <button type="button" class="icon-btn" data-action="attach-unpick" data-index="${i}" aria-label="${esc(f.name)} 빼기">${ICON.close}</button></li>`).join('')}
          </ul>` : ''}
        ${rejected.length ? `<div class="attach-rejected">${rejected.map((r) => `${esc(r.name)} — ${esc(r.reason)}`).join('<br>')}</div>` : ''}
        <div class="sheet-note">파일은 이 브라우저에만 저장돼요. 주간 보고의 자료 목록 ‘첨부자료’ 칸에서 다시 열 수 있어요.</div>
      </div>

      <footer class="sheet-foot">
        <button type="button" class="btn btn-sub" data-action="attach-close">${justDone ? '나중에 첨부' : '닫기'}</button>
        <button type="button" class="btn btn-cta" data-action="attach-save" ${pending.length && !saving ? '' : 'disabled'}>${saving ? '저장 중…' : pending.length ? `${pending.length}개 첨부하기` : '첨부하기'}</button>
      </footer>
    </div>`;
}

/** 주간 보고 자료 목록의 '첨부자료' 칸 */
export function attachCell(row) {
  const files = row.attachments || [];
  const list = files.map((a) => `
    <span class="att-file">
      <button type="button" class="att-link" data-action="open-attachment" data-item="${esc(row.id)}" data-file="${esc(a.id)}" title="${esc(a.name)} · ${formatSize(a.size)}">${ICON.download}<span>${esc(a.name)}</span></button>
      <button type="button" class="att-remove" data-action="remove-attachment" data-item="${esc(row.id)}" data-file="${esc(a.id)}" aria-label="${esc(a.name)} 첨부 삭제">${ICON.close}</button>
    </span>`).join('');
  const add = row.status === 'done'
    ? `<button type="button" class="att-add" data-action="attach-open" data-item="${esc(row.id)}">${ICON.plus}첨부</button>` : '';
  return list || add ? `<div class="att-cell">${list}${add}</div>` : '—';
}
