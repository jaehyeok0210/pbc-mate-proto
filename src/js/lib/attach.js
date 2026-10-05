// 완료한 자료에 받은 파일을 첨부한다. 파일 내용은 브라우저 저장소(files.js, IndexedDB)에,
// 자료에는 목록만 둔다: item.attachments = [{ id, name, size, type, addedOn }]
// 순수 함수만 둔다.

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 한 파일 20MB까지

/** 1536 → '1.5KB' */
export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * 고른 파일 검사. files: [{ name, size }]
 * - 빈 파일, 너무 큰 파일은 뺀다
 * - 이 자료에 이미 같은 이름으로 첨부한 파일, 이번에 고른 것 안에서 같은 이름도 뺀다
 * @returns {{ ok: object[], rejected: { name, reason }[] }}
 */
export function checkFiles(files, existing = [], maxBytes = MAX_FILE_BYTES) {
  const names = new Set(existing.map((a) => a.name));
  const ok = [];
  const rejected = [];
  for (const f of files) {
    if (!f.size) rejected.push({ name: f.name, reason: '빈 파일' });
    else if (f.size > maxBytes) rejected.push({ name: f.name, reason: `${formatSize(maxBytes)} 초과` });
    else if (names.has(f.name)) rejected.push({ name: f.name, reason: '이미 첨부한 파일' });
    else { names.add(f.name); ok.push(f); }
  }
  return { ok, rejected };
}

/** 첨부 목록을 더한 새 자료 */
export function addAttachments(item, metas) {
  return { ...item, attachments: [...(item.attachments || []), ...metas] };
}

/** 첨부 하나를 뺀 새 자료 */
export function removeAttachment(item, fileId) {
  return { ...item, attachments: (item.attachments || []).filter((a) => a.id !== fileId) };
}

/** 저장소 키. 같은 밀리초에 여러 개를 올려도 겹치지 않게 순번을 붙인다. */
export function newFileId(now = Date.now(), seq = 0) {
  return `f${now.toString(36)}${seq.toString(36)}`;
}
