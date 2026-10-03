# PBC Mate

삼일 연수 과제용 MVP. 회계감사 PBC(Prepared By Client) 자료 요청을 추적하고,
미제출 건에 대한 독촉·보완 요청 메일 문안을 만들어 주는 웹 도구.

> 상태: 설계 단계 — 기능 구현 전

## 실행

빌드 과정 없음. 정적 파일 서버로 `src/`를 열면 된다.

```bash
python3 -m http.server 8000 --directory src
```

→ http://localhost:8000

(ES 모듈을 쓰기 때문에 `index.html`을 파일로 직접 열면 동작하지 않는다.)

## 폴더 구조

```
.
├── reference/
│   └── pbc-mate-ui-reference.html   # 디자인 원본 (수정 금지)
├── src/                             # 실제 앱 코드
│   ├── index.html
│   ├── styles.css
│   └── js/
│       ├── main.js                  # 진입점, 화면 전환
│       ├── store.js                 # 데이터 저장 (localStorage)
│       ├── views/                   # 화면별 렌더링
│       └── lib/                     # 순수 함수 (날짜 계산, 메일 문안 생성)
├── tests/                           # lib/ 순수 함수 테스트 (node --test)
├── CLAUDE.md                        # 작업 지침
└── README.md
```

## 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 화면 | HTML + CSS + Vanilla JS (ES 모듈) | 빌드·의존성 없이 바로 실행 |
| 데이터 | `localStorage` | 서버 없이 MVP 동작 확인 |
| 테스트 | Node 내장 `node:test` | 추가 설치 없음 |
| 실행 | `python3 -m http.server` | macOS 기본 탑재 |

## 디자인 레퍼런스

`reference/pbc-mate-ui-reference.html`을 브라우저로 열면 화면 17개를 볼 수 있다.

1. 대시보드 (필요일순 / 경과일순 / 모바일)
2. 단건 독촉 (정중 / 단호 / 매니저 참조 / 복사 완료 / 모바일)
3. 묶음 독촉
4. 보완 요청 (기준일 상이 / 서명 누락)
5. 발송 시점 안내
6. 자료 추가 (한 건씩 / 엑셀 붙여넣기)
7. 주간 현황 보고
8. 빈 상태 (첫 실행)
9. 공통 요소
