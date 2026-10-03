/**
 * 단어 끝 글자의 받침 유무로 조사를 고른다.
 * josa('은행조회서 회신', '이', '가') → '이'
 * 한글로 끝나지 않으면 판단할 수 없어 '이(가)' 형태로 둘 다 쓴다.
 */
export function josa(word, withBatchim, withoutBatchim) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${withBatchim}(${withoutBatchim})`;
  return code % 28 === 0 ? withoutBatchim : withBatchim;
}
