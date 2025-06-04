# OCR 서비스 설정 가이드

## 문제 해결

현재 OCR 처리 중 "1021 - Not Found Deploy Info" 오류가 발생하는 이유는 네이버 클라우드 플랫폼의 OCR 템플릿이 올바르게 설정되지 않았기 때문입니다.

## 해결 방법

### 1. 네이버 클라우드 플랫폼 OCR 설정

1. [네이버 클라우드 플랫폼](https://console.ncloud.com/)에 로그인
2. AI·Application 서비스 > Clova OCR로 이동
3. 새로운 OCR 서비스 생성 또는 기존 서비스 확인
4. 템플릿 설정:
   - 일반 OCR 또는 영수증 전용 템플릿 생성
   - 템플릿이 "배포됨" 상태인지 확인
5. API 정보 확인:
   - Secret Key 복사
   - API Gateway Invoke URL 복사

### 2. 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가:

```
# Naver Clova OCR Configuration
EXPO_PUBLIC_CLOVA_OCR_SECRET_KEY=your_actual_secret_key_here
EXPO_PUBLIC_CLOVA_OCR_API_URL=https://your_actual_endpoint.apigw.ntruss.com/custom/v1/your_template_id/your_domain_id/infer
```

### 3. 현재 하드코딩된 값 확인

현재 코드에 하드코딩된 값들:
- Secret Key: `RUh3UkpReVVSeWVkTHRYS2pZbnFkdm11Tm5BYUtHTm8=`
- API URL: `https://suz0e9o2x4.apigw.ntruss.com/custom/v1/42611/34a389d790fc2bdd8458e5f1cde6933c97d11eeda65cf328b64460f0d68f04b5/infer`

이 값들이 실제 배포된 OCR 서비스와 일치하지 않아 오류가 발생합니다.

### 4. 템플릿 재배포

네이버 클라우드 플랫폼에서:
1. OCR 서비스 > 템플릿 관리로 이동
2. 해당 템플릿 선택
3. "배포" 버튼 클릭
4. 배포 완료까지 대기

### 5. 테스트

환경변수 설정 후 앱을 재시작하고 OCR 기능을 테스트해보세요.

## 변경사항

1. ✅ OCR 테스트 버튼 제거됨
2. ✅ 환경변수를 통한 API 설정으로 변경
3. ✅ 더 나은 오류 메시지 제공
4. ✅ API 설정 검증 추가

## 추가 도움말

문제가 계속 발생하면:
1. 네이버 클라우드 플랫폼 콘솔에서 OCR 서비스 상태 확인
2. API 키와 엔드포인트가 올바른지 재확인
3. 템플릿이 올바르게 배포되었는지 확인
4. 네트워크 연결 상태 확인 