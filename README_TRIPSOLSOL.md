# TripSolSol 🧳✈️

여행 정산을 쉽고 간편하게! Splitwise와 같은 여행 정산 앱입니다.

## 🚀 주요 기능

- **사용자 인증**: Firebase Authentication을 통한 회원가입/로그인
- **여행 관리**: 여행 생성, 참가자 초대, 여행 정보 관리
- **비용 추가**: 카테고리별 비용 기록 및 영수증 첨부
- **자동 정산**: 참가자 간 비용 분할 및 정산 금액 계산
- **정산 현황**: 실시간 정산 현황 및 차트 시각화
- **알림**: 정산 요청 및 완료 알림

## 🛠 기술 스택

- **Frontend**: React Native (Expo)
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **Language**: TypeScript
- **UI Components**: React Native Paper, Expo Vector Icons
- **Charts**: React Native Chart Kit

## 📱 화면 구성

1. **인증 화면**
   - 로그인 (`/auth/login`)
   - 회원가입 (`/auth/signup`)

2. **메인 화면**
   - 여행 목록 (`/(tabs)/index`)
   - 여행 생성 (`/trip/create`)

3. **여행 상세**
   - 여행 정보 (`/trip/[id]`)
   - 비용 추가 (`/trip/[id]/expense/add`)
   - 정산 현황 (`/trip/[id]/balance`)

## 🔧 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. Firebase 설정

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트 생성
2. Authentication, Firestore Database, Storage 활성화
3. `config/firebase.ts` 파일에서 Firebase 설정 정보 업데이트:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 3. 앱 실행

```bash
# 개발 서버 시작
npm start

# Android에서 실행
npm run android

# iOS에서 실행 (macOS 필요)
npm run ios

# 웹에서 실행
npm run web
```

## 📊 데이터 구조

### User
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
  createdAt: Date;
}
```

### Trip
```typescript
interface Trip {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  participants: string[]; // User IDs
  createdBy: string; // User ID
  createdAt: Date;
  currency: string;
  totalAmount: number;
}
```

### Expense
```typescript
interface Expense {
  id: string;
  tripId: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  paidBy: string; // User ID
  splitBetween: string[]; // User IDs
  category: ExpenseCategory;
  date: Date;
  receipt?: string; // Image URL
  createdAt: Date;
}
```

## 🔐 보안 설정

### Firestore 보안 규칙 예시

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Trip access control
    match /trips/{tripId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
    
    // Expense access control
    match /expenses/{expenseId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/trips/$(resource.data.tripId)) &&
        request.auth.uid in get(/databases/$(database)/documents/trips/$(resource.data.tripId)).data.participants;
    }
  }
}
```

## 🎨 UI/UX 특징

- **직관적인 디자인**: 깔끔하고 사용하기 쉬운 인터페이스
- **반응형 레이아웃**: 다양한 화면 크기에 최적화
- **실시간 업데이트**: Firebase를 통한 실시간 데이터 동기화
- **오프라인 지원**: Firestore의 오프라인 캐싱 기능 활용

## 🚧 향후 개발 계획

- [ ] 푸시 알림 기능
- [ ] 영수증 OCR 인식
- [ ] 다국어 지원
- [ ] 소셜 로그인 (Google, Apple)
- [ ] 정산 내역 PDF 내보내기
- [ ] 그룹 채팅 기능
- [ ] 여행 사진 공유

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 문의

프로젝트에 대한 문의사항이나 버그 리포트는 GitHub Issues를 통해 제출해주세요.

---

**TripSolSol**로 더 스마트한 여행 정산을 경험해보세요! 🎉 