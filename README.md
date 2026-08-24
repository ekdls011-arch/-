# 연차 원장 — 세종장애인보호작업장

클로드 아티팩트에서 만든 연차관리 대시보드를, 로그인 없이 누구나 접속 가능한
실제 웹사이트로 배포하기 위한 프로젝트입니다.

## 가장 빠른 방법: Netlify Drop (계정 불필요, 5분)

1. 이 폴더에서 터미널로 아래 명령 실행 (최초 1회):
   ```
   npm install
   npm run build
   ```
   → `dist` 폴더가 생성됩니다.
2. 브라우저에서 https://app.netlify.com/drop 접속
3. `dist` 폴더를 그대로 화면에 드래그 앤 드롭
4. 몇 초 뒤 `https://무작위이름.netlify.app` 같은 실제 주소가 생성됩니다.
   → 이 링크를 누구에게나 보내면 로그인 없이 바로 열립니다.

단점: 나중에 코드를 수정하면 다시 dist를 만들어서 재업로드해야 합니다.

## 계속 관리하며 쓰고 싶다면: GitHub + Vercel (계정 필요, 15분)

1. https://github.com 에서 새 저장소(Repository) 생성 (예: `leave-ledger`)
2. 이 폴더 전체를 그 저장소에 업로드
   (GitHub Desktop 앱을 쓰면 폴더를 드래그하는 것만으로 가능합니다)
3. https://vercel.com 가입 (GitHub 계정으로 로그인 가능)
4. "Add New → Project" → 방금 만든 GitHub 저장소 선택 → "Deploy" 클릭
5. Vercel이 자동으로 `npm install`, `npm run build`를 실행하고
   `https://leave-ledger-xxxx.vercel.app` 같은 영구 주소를 줍니다.
6. 이후 코드를 고쳐서 GitHub에 다시 업로드(push)하면, Vercel이 자동으로 재배포합니다.

## Firebase 백엔드 연동 (여러 관리자가 실시간으로 데이터 공유)

이 프로젝트는 이미 Firestore(Firebase의 데이터베이스)와 연동되도록 코드가 준비되어 있습니다.
아래 순서대로 다인님의 Firebase 프로젝트에 연결하기만 하면 됩니다.

1. **Firebase 프로젝트 생성**: https://console.firebase.google.com → "프로젝트 추가"
2. **Firestore 활성화**: 왼쪽 메뉴 "Firestore Database" → "데이터베이스 만들기" → 테스트 모드로 시작 (위치는 asia-northeast3 추천)
3. **웹 앱 등록**: 프로젝트 설정(톱니바퀴) → "앱 추가" → 웹(</>) → 나오는 `firebaseConfig` 값을 복사
4. **설정 붙여넣기**: `src/firebaseConfig.js` 파일을 열어서 복사한 값을 그대로 붙여넣기
5. **로그인 활성화**: 왼쪽 메뉴 "Authentication" → "시작하기" → "이메일/비밀번호" 사용 설정 → "사용자" 탭에서 다인님과 동료 관리자 이메일을 직접 추가
6. **보안 규칙 설정**: "Firestore Database → 규칙" 탭에서 아래 내용으로 교체 후 "게시"
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   이렇게 하면 로그인한 사용자만 데이터를 읽고 쓸 수 있습니다. 이 단계를 건너뛰면
   링크만 아는 누구나 데이터를 보고 지울 수 있으니 실제 데이터를 올리기 전 반드시 설정하세요.
7. **로컬에서 테스트**: `npm run dev` 실행 후 5단계에서 추가한 이메일/비밀번호로 로그인해서 확인
8. **재배포**: `npm run build` 후 새 `dist` 폴더를 Netlify Drop에 다시 올리거나, GitHub에 push하면 Vercel이 자동 재배포합니다

연동 후에는 "공유" 버튼을 켜면 로그인한 모든 관리자가 진짜 같은 데이터를 실시간으로 보게 됩니다.
`src/storagePolyfill.js`(로컬 저장 버전)는 더 이상 쓰이지 않으니 참고용으로만 남겨두었습니다.

## 데이터 저장 방식 (Firebase 연동 전 · localStorage 버전)

이 프로젝트는 원래 클로드 아티팩트의 `window.storage`를 그대로 쓰기 위해
`src/storagePolyfill.js`에서 브라우저의 `localStorage`로 흉내를 냈습니다.

- **개인 모드**: 이 브라우저(이 기기)에만 데이터가 저장됩니다.
- **공유 모드**: 앱 안에서는 "공유"라고 표시되지만, 실제로는 여전히
  **기기마다 따로 저장**됩니다. 즉 다인님 컴퓨터와 동료 컴퓨터가 서로 다른
  데이터를 보게 됩니다.

**여러 사람이 진짜 같은 데이터를 실시간으로 보게 하려면**
Firebase(구글) 또는 Supabase 같은 무료 백엔드 서비스가 필요합니다.
`src/storagePolyfill.js` 파일 하나만 해당 서비스의 API 호출로 교체하면
`App.jsx`의 나머지 코드는 전혀 손댈 필요가 없습니다. 이 작업이 필요하시면
말씀해 주세요 — 다음 단계로 이어서 도와드릴 수 있습니다.
