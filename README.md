# 🎨 근육고양이 그림판

> 홍대 근육고양이잡화점에서 방명록으로 사용되는 그림판 애플리케이션입니다.   
> **SvelteKit**과 **Firebase**로 만든 모바일 최적화 터치 드로잉 웹앱입니다.  
> 부드러운 필기감과 실시간 갤러리, PWA 기능을 제공합니다.

![Project Banner](https://via.placeholder.com/1200x600?text=MuscleCat+Drawing+App+Screenshot)
*(준비중)*

## ✨ 주요 기능 (Features)

### 🖌️ 드로잉 (Drawing)
- **부드러운 선:** `perfect-freehand` 라이브러리를 활용한 압력 감지 및 곡선 보정
- **다양한 도구:** 펜(Pen), 지우개(Eraser), 채우기(Flood Fill)
- **커스터마이징:** 색상 선택(커스텀/프리셋) 및 브러시 굵기 조절
- **히스토리:** 실행 취소(Undo) 및 다시 실행(Redo) 지원

### 📱 모바일 & UX 최적화
- **PWA 지원:** 홈 화면에 설치하여 네이티브 앱처럼 사용 가능
- **반응형 툴바:** 모바일 화면에서도 잘리지 않는 가로 스크롤 툴바
- **제스처:** 멀티터치 및 터치 스크롤 방지 처리

### 🖼️ 갤러리 & 소셜
- **실시간 저장:** Firebase Storage에 작품 자동 저장 (AVIF 포맷 최적화)
- **갤러리 슬라이드:** `Embla Carousel`을 이용한 부드러운 이미지 탐색
- **좋아요 시스템:** 작품에 좋아요(♥) 표시 (1분 쿨타임 적용)
- **관리 기능:** 작성 직후 15분 이내 삭제 가능, 별도 관리자 페이지(`/admin`) 제공

---

## 🛠 기술 스택 (Tech Stack)

- **Framework:** [SvelteKit](https://kit.svelte.dev/)
- **Language:** JavaScript
- **Styling:** CSS Modules (Scoped CSS)
- **Drawing Engine:** [Perfect Freehand](https://github.com/steveruizok/perfect-freehand)
- **Backend / DB:** [Firebase](https://firebase.google.com/) (Storage, Metadata)
- **UI Libraries:** `embla-carousel-svelte` (Slider), `svelte-transition` (Animation)
- **Deployment:** Vercel

---

## 🚀 시작하기 (Getting Started)

이 프로젝트를 로컬에서 실행하려면 다음 단계들을 따라주세요.

### 1. 설치 (Installation)

```bash
# 저장소 클론
git clone [https://github.com/username/musclecat-drawing.git](https://github.com/username/musclecat-drawing.git)

# 폴더 이동
cd musclecat-drawing

# 패키지 설치
npm install
2. 환경 변수 설정 (Environment Setup)
프로젝트 루트에 .env 또는 .env.local 파일을 생성하고 Firebase 설정 정보를 입력하세요.

코드 스니펫

VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
3. 실행 (Run)
개발 서버를 실행합니다.

Bash

npm run dev
브라우저에서 http://localhost:5173으로 접속하여 앱을 확인하세요.

📂 프로젝트 구조 (Structure)
src/
├── lib/
│   ├── components/    # 재사용 가능한 UI 컴포넌트 (Dialog 등)
│   ├── stores/        # 전역 상태 관리 (Svelte Store)
│   └── firebase.js    # Firebase 초기화 및 설정
├── routes/
│   ├── admin/         # 관리자 페이지
│   └── +page.svelte   # 메인 드로잉 앱 페이지
└── static/            # PWA 아이콘 및 정적 파일
📜 라이선스 (License)
This project is licensed under the MIT License.