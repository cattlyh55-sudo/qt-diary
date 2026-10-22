# 큐티일기

CDC 큐티일기 양식에 맞춰 작성하고 PDF/사진으로 내보내는 웹앱(PWA).
서버 없이 정적 파일만으로 동작하며, 작성 내용은 각자 기기 브라우저(localStorage)에 저장된다.

## 기능
- 조·이름 자동 입력, 날짜 기본값 오늘, 입력 즉시 자동 저장
- 양식 그대로 A4 PDF / PNG 내보내기 (내용이 길면 글자 크기 자동 축소 → 그래도 넘치면 다음 페이지로 이어짐)
- 모아보기: 주 단위로 묶어 한 PDF로 내보내기 (주 시작 요일은 설정에서 변경)
- 모바일에서는 "공유" 버튼으로 카카오톡 등에 바로 전송
- 백업/복원(JSON)
- 오프라인 동작, 홈 화면에 추가 가능

## 배포 (GitHub Pages, 무료)
1. GitHub에서 새 저장소 생성 (Public)
2. "uploading an existing file"을 눌러 이 폴더의 파일/폴더 전체를 드래그해서 업로드
3. Settings → Pages → Branch: `main` / `(root)` → Save
4. 1~2분 뒤 `https://<아이디>.github.io/<저장소이름>/` 주소를 친구들에게 공유

## 홈 화면에 추가
- 아이폰: Safari로 열기 → 공유 버튼 → "홈 화면에 추가"
- 안드로이드: Chrome으로 열기 → 메뉴(⋮) → "홈 화면에 추가" / "앱 설치"

## 로컬에서 실행
```
python3 -m http.server 8000
```
→ http://localhost:8000

## 파일 구성
- `index.html`, `style.css`, `app.js` — 화면과 저장/내보내기 로직
- `render.js` — 양식을 캔버스에 그리는 코드 (좌표는 원본 PDF 기준 pt)
- `assets/header.png` — 원본 양식에서 잘라낸 헤더(로고 + 입력칸)
- `sw.js` — 오프라인 캐시. 파일 수정 후 배포할 때 `VERSION`을 올려 준다
- `vendor/jspdf.umd.min.js` — jsPDF 2.5.1
