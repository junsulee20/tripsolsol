import { Platform } from 'react-native';

// Naver Clova OCR API 설정 - 환경변수만 사용
const CLOVA_OCR_CONFIG = {
  secretKey: process.env.EXPO_PUBLIC_CLOVA_OCR_SECRET_KEY,
  apiUrl: process.env.EXPO_PUBLIC_CLOVA_OCR_API_URL
};

export interface OCRResult {
  amount?: string;
  description?: string;
  rawText: string;
  confidence?: number;
  candidateNumbers?: string[];
  expenseItems?: ExpenseItem[];
}

// 개별 지출 항목 인터페이스 추가
export interface ExpenseItem {
  amount: string;
  description: string;
  originalText: string; // OCR에서 인식된 원본 텍스트
  confidence?: number;
}

// 이미지 형식 감지
const getImageFormat = (imageUri: string): string => {
  const extension = imageUri.toLowerCase().split('.').pop();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'jpg';
    case 'png':
      return 'png';
    default:
      return 'jpg'; // 기본값
  }
};

// 영수증에서 금액 후보 숫자들 추출 (개선된 버전)
const extractCandidateNumbers = (text: string): string[] => {
  console.log('=== Enhanced Candidate Numbers Extraction ===');
  console.log('Input text:', text);
  
  const candidates: string[] = [];
  const seenNumbers = new Set<string>(); // 중복 방지
  
  // 텍스트를 라인별로 분리
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // 각 라인을 분석하여 컨텍스트 기반으로 숫자 분류
  for (const line of lines) {
    const lineNumbers = extractNumbersWithContext(line);
    lineNumbers.forEach(num => {
      if (!seenNumbers.has(num)) {
        seenNumbers.add(num);
        candidates.push(num);
      }
    });
  }
  
  // 숫자 크기순으로 정렬 (큰 금액부터)
  candidates.sort((a, b) => {
    const numA = parseFloat(a.replace(/,/g, ''));
    const numB = parseFloat(b.replace(/,/g, ''));
    return numB - numA;
  });
  
  console.log('Enhanced filtered candidate numbers:', candidates);
  return candidates.slice(0, 10); // 최대 10개까지만 반환
};

// 컨텍스트 기반 숫자 추출 및 분류 (새로 추가)
const extractNumbersWithContext = (line: string): string[] => {
  const validNumbers: string[] = [];
  const lineText = line.toLowerCase();
  
  // 1. 제외할 패턴들 (카드번호, 전화번호, 사업자번호, 영수증번호 등)
  const excludePatterns = [
    // 카드번호 패턴 (4자리씩 구분된 16자리)
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    // 전화번호 패턴
    /\b\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4}\b/g,
    // 사업자등록번호 패턴 (10자리)
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{5}\b/g,
    // 계좌번호 패턴 (긴 숫자)
    /\b\d{8,20}\b/g,
    // 영수증/주문번호 패턴 (영문+숫자 조합)
    /\b[A-Z]{2,}\d{6,}\b/g,
    // 일시/날짜 패턴
    /\b\d{4}[-/]\d{2}[-/]\d{2}\b/g,
    /\b\d{2}[-/]\d{2}[-/]\d{4}\b/g,
    // 시간 패턴
    /\b\d{1,2}:\d{2}(:\d{2})?\b/g,
  ];
  
  // 제외 패턴에 해당하는지 확인
  for (const pattern of excludePatterns) {
    if (pattern.test(line)) {
      console.log(`Line excluded due to pattern: ${line}`);
      return [];
    }
  }
  
  // 2. 포함할 키워드들 (실제 지출과 관련된 컨텍스트)
  const includeKeywords = [
    // 금액 관련 키워드
    '합계', '총액', '총계', '금액', '결제', '지불', '요금', '가격', '비용',
    'total', 'amount', 'sum', 'payment', 'charge', 'price', 'cost',
    // 세금 관련
    '부가세', '세액', '면세', 'tax', 'vat',
    // 할인 관련
    '할인', '적립', '쿠폰', 'discount', 'point',
    // 영수증 항목
    '잔액', '거스름돈', '현금', '카드', 'cash', 'card',
    // 상품/서비스 관련
    '상품', '서비스', '메뉴', '주문', 'item', 'menu', 'order'
  ];
  
  // 3. 제외할 키워드들 (지출과 무관한 숫자들)
  const excludeKeywords = [
    // 카드 관련
    '카드번호', '카드no', 'card number', 'card no',
    // 영수증 관련
    '영수증번호', '주문번호', '거래번호', '승인번호', '가맹점번호',
    'receipt no', 'order no', 'transaction no', 'approval no',
    // 사업자 정보
    '사업자번호', '사업자등록번호', 'business number',
    // 연락처
    '전화번호', '전화', 'tel', 'phone',
    // 주소
    '우편번호', 'postal code', 'zip code',
    // 기타
    '테이블', '좌석', 'table', 'seat'
  ];
  
  // 4. 숫자 패턴 매칭
  const numberPatterns = [
    // 쉼표가 포함된 숫자
    /([0-9]{1,3}(?:,[0-9]{3})+)/g,
    // 소수점 포함 숫자
    /([0-9]+\.[0-9]{1,2})/g,
    // 일반 정수 (3자리 이상)
    /(?<![0-9])([0-9]{3,8})(?![0-9])/g,
    // 원화 표시
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*원/g,
    // 통화 기호
    /[₩$]\s*([0-9,]+(?:\.[0-9]{1,2})?)/g
  ];
  
  // 제외 키워드가 포함된 라인은 건너뛰기
  const hasExcludeKeyword = excludeKeywords.some(keyword => 
    lineText.includes(keyword.toLowerCase())
  );
  
  if (hasExcludeKeyword) {
    console.log(`Line excluded due to exclude keyword: ${line}`);
    return [];
  }
  
  // 포함 키워드가 있는 라인에 가중치 부여
  const hasIncludeKeyword = includeKeywords.some(keyword => 
    lineText.includes(keyword.toLowerCase())
  );
  
  // 숫자 추출 및 검증
  for (const pattern of numberPatterns) {
    const matches = line.matchAll(pattern);
    for (const match of matches) {
      let numberStr = match[1] || match[0];
      const cleanNumber = numberStr.replace(/,/g, '');
      const numValue = parseFloat(cleanNumber);
      
      // 기본 필터링 조건
      if (isNaN(numValue)) continue;
      if (cleanNumber.length >= 10) continue; // 10자리 이상 제외
      if (numValue < 10 || numValue > 10000000) continue; // 범위 제한
      
      // 컨텍스트 기반 추가 검증
      if (isLikelyValidAmount(numValue, line, hasIncludeKeyword)) {
        const displayNumber = numValue >= 1000 ? 
          numValue.toLocaleString() : 
          cleanNumber;
        validNumbers.push(displayNumber);
      }
    }
  }
  
  return validNumbers;
};

// 유효한 금액인지 컨텍스트 기반 판단 (새로 추가)
const isLikelyValidAmount = (amount: number, context: string, hasIncludeKeyword: boolean): boolean => {
  const contextLower = context.toLowerCase();
  
  // 1. 포함 키워드가 있으면 가중치 높임
  if (hasIncludeKeyword) {
    return true;
  }
  
  // 2. 의심스러운 패턴들 체크
  const suspiciousPatterns = [
    // 연속된 같은 숫자 (1111, 2222 등)
    /(\d)\1{3,}/,
    // 순차적 숫자 (1234, 5678 등)
    /(?:0123|1234|2345|3456|4567|5678|6789)/,
    // 년도 패턴 (19xx, 20xx)
    /\b(19|20)\d{2}\b/,
    // 월/일 패턴
    /\b(0[1-9]|1[0-2])[/\-](0[1-9]|[12]\d|3[01])\b/,
  ];
  
  const amountStr = amount.toString();
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(amountStr) || pattern.test(context)) {
      console.log(`Amount ${amount} excluded due to suspicious pattern in: ${context}`);
      return false;
    }
  }
  
  // 3. 일반적인 가격 범위 체크
  // 너무 둥근 숫자는 의심스러움 (ex: 10000, 50000은 가격보다는 포인트일 가능성)
  if (amount >= 10000 && amount % 10000 === 0 && !hasIncludeKeyword) {
    console.log(`Amount ${amount} excluded as likely points/miles`);
    return false;
  }
  
  // 4. 부가세 계산 검증 (10% 또는 8.8%)
  const possibleBase = amount / 1.1; // 부가세 포함 금액에서 원가 계산
  const vatAmount = amount - possibleBase;
  if (Math.abs(vatAmount - possibleBase * 0.1) < 1) {
    // 부가세가 정확히 10%인 경우, 실제 거래 금액일 가능성 높음
    return true;
  }
  
  // 5. 기본적으로 허용 (다른 필터에서 걸러지지 않았다면)
  return true;
};

// 스마트 금액 추출 (기존 extractPriceFromText 개선)
const extractSmartPriceFromText = (text: string): string | null => {
  console.log('=== Smart Price Extraction ===');
  console.log('Input text for smart price extraction:', text);
  
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const priceScores: Array<{amount: number, score: number, context: string}> = [];
  
  // 각 라인을 분석하여 가격 후보와 점수 계산
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    
    // 총액/합계 키워드가 있는 라인에서 숫자 찾기
    const totalKeywords = ['합계', '총액', '총계', '결제금액', 'total', 'amount', 'sum'];
    const hasTotalKeyword = totalKeywords.some(keyword => lineLower.includes(keyword));
    
    if (hasTotalKeyword) {
      const amounts = extractAmountsFromLine(line);
      amounts.forEach(amount => {
        priceScores.push({
          amount: amount,
          score: 100, // 최고 점수
          context: line
        });
      });
      continue;
    }
    
    // 부가세 관련 라인 체크
    const taxKeywords = ['부가세', '세액', 'vat', 'tax'];
    const hasTaxKeyword = taxKeywords.some(keyword => lineLower.includes(keyword));
    
    if (hasTaxKeyword) {
      const amounts = extractAmountsFromLine(line);
      amounts.forEach(amount => {
        // 부가세 금액으로부터 원래 금액 추정
        const estimatedTotal = amount * 11; // 부가세 10% 가정
        if (estimatedTotal >= 100 && estimatedTotal <= 1000000) {
          priceScores.push({
            amount: estimatedTotal,
            score: 80,
            context: `Estimated from tax: ${line}`
          });
        }
      });
    }
    
    // 일반 금액 라인
    const amounts = extractAmountsFromLine(line);
    amounts.forEach(amount => {
      let score = 50; // 기본 점수
      
      // 원화 표시가 있으면 점수 증가
      if (line.includes('원') || line.includes('₩')) {
        score += 20;
      }
      
      // 적절한 가격 범위면 점수 증가
      if (amount >= 1000 && amount <= 100000) {
        score += 10;
      }
      
      // 너무 둥근 숫자는 점수 감소
      if (amount % 1000 === 0 && amount >= 10000) {
        score -= 20;
      }
      
      priceScores.push({
        amount: amount,
        score: score,
        context: line
      });
    });
  }
  
  // 점수가 높은 순으로 정렬
  priceScores.sort((a, b) => b.score - a.score);
  
  console.log('Price candidates with scores:', priceScores);
  
  if (priceScores.length > 0) {
    const bestCandidate = priceScores[0];
    console.log('Selected best price candidate:', bestCandidate);
    
    const result = bestCandidate.amount >= 100 ? 
      bestCandidate.amount.toFixed(0) : 
      bestCandidate.amount.toFixed(2);
    
    return result;
  }

  console.log('No valid price candidates found');
  return null;
};

// 라인에서 금액들 추출 (헬퍼 함수)
const extractAmountsFromLine = (line: string): number[] => {
  const amounts: number[] = [];
  
  const patterns = [
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*원/g,
    /₩\s*([0-9,]+(?:\.[0-9]{1,2})?)/g,
    /\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/g,
    /([0-9]{1,3}(?:,[0-9]{3})+)/g,
    /([0-9]+\.[0-9]{1,2})/g,
    /\b([0-9]{3,7})\b/g
  ];
  
  for (const pattern of patterns) {
    const matches = line.matchAll(pattern);
    for (const match of matches) {
      const amountStr = match[1] || match[0];
      const cleanAmount = amountStr.replace(/,/g, '');
      const amount = parseFloat(cleanAmount);
      
      if (!isNaN(amount) && amount >= 10 && amount <= 10000000) {
        amounts.push(amount);
      }
    }
  }
  
  return amounts;
};

// 설명 추출 (상호명, 품목 등)
const extractDescriptionFromText = (text: string): string => {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // 첫 번째 의미있는 라인을 상호명으로 간주
  for (const line of lines) {
    const cleanLine = line.trim();
    // 숫자나 특수문자만 있는 라인은 제외
    if (cleanLine.length > 2 && !/^[0-9\s\-.:,₩$]+$/.test(cleanLine)) {
      return cleanLine;
    }
  }

  return '영수증';
};

// Base64로 이미지 인코딩 (React Native용)
const imageToBase64 = async (imageUri: string): Promise<string> => {
  console.log('=== Image to Base64 Conversion ===');
  console.log('Platform:', Platform.OS);
  console.log('Input URI:', imageUri);
  
  if (Platform.OS === 'web') {
    console.log('Using web conversion method...');
    try {
      // 웹에서는 File API 사용
      const response = await fetch(imageUri);
      console.log('Fetch response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('Blob size:', blob.size, 'bytes');
      console.log('Blob type:', blob.type);
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1]; // data:image/jpeg;base64, 부분 제거
          console.log('Web base64 conversion completed. Length:', base64Data.length);
          resolve(base64Data);
        };
        reader.onerror = (error) => {
          console.error('FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Web image conversion failed:', error);
      throw new Error('웹에서 이미지 변환에 실패했습니다: ' + (error as Error).message);
    }
  } else {
    console.log('Using React Native conversion method...');
    // React Native에서는 FileSystem 사용
    try {
      const FileSystem = require('expo-file-system');
      console.log('FileSystem module loaded');
      
      // 파일 정보 확인
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('파일이 존재하지 않습니다: ' + imageUri);
      }
      
      console.log('Reading file as base64...');
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('React Native base64 conversion completed. Length:', base64.length);
      return base64;
    } catch (error) {
      console.error('FileSystem conversion failed:', error);
      throw new Error('이미지 변환에 실패했습니다: ' + (error as Error).message);
    }
  }
};

// 개별 지출 항목들 추출 (새로 추가)
const extractExpenseItems = (text: string): ExpenseItem[] => {
  console.log('=== Expense Items Extraction ===');
  console.log('Input text:', text);
  
  const items: ExpenseItem[] = [];
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 각 라인에서 금액과 설명을 추출하려고 시도
    const expenseItem = extractExpenseFromLine(line);
    if (expenseItem) {
      items.push(expenseItem);
    }
    
    // 다음 라인과 조합해서 지출 항목을 만들어보기 (금액과 설명이 분리된 경우)
    if (i < lines.length - 1) {
      const nextLine = lines[i + 1].trim();
      const combinedItem = extractExpenseFromCombinedLines(line, nextLine);
      if (combinedItem) {
        items.push(combinedItem);
        i++; // 다음 라인 건너뛰기
      }
    }
  }
  
  // 중복 제거 및 정렬
  const uniqueItems = removeDuplicateItems(items);
  
  // 금액 크기순으로 정렬 (큰 금액부터)
  uniqueItems.sort((a, b) => {
    const amountA = parseFloat(a.amount.replace(/[^0-9.]/g, ''));
    const amountB = parseFloat(b.amount.replace(/[^0-9.]/g, ''));
    return amountB - amountA;
  });
  
  console.log('Extracted expense items:', uniqueItems);
  return uniqueItems.slice(0, 10); // 최대 10개만 반환
};

// 단일 라인에서 지출 항목 추출
const extractExpenseFromLine = (line: string): ExpenseItem | null => {
  // 다양한 패턴으로 "설명 + 금액" 형태 인식
  const patterns = [
    // 1. "상품명 금액원" 형태
    /^(.+?)\s+([0-9,]+(?:\.[0-9]{1,2})?)\s*원?\s*$/,
    
    // 2. "상품명 ₩금액" 형태  
    /^(.+?)\s+₩\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*$/,
    
    // 3. "상품명 $금액" 형태
    /^(.+?)\s+\$\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*$/,
    
    // 4. "금액 상품명" 형태 (순서 바뀐 경우)
    /^([0-9,]+(?:\.[0-9]{1,2})?)\s*원?\s+(.+)$/,
    
    // 5. "상품명: 금액" 형태
    /^(.+?):\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*원?\s*$/,
    
    // 6. 카드 내역 형태 "MM/DD 상점명 금액"
    /^(?:\d{2}\/\d{2}|\d{4}-\d{2}-\d{2})\s+(.+?)\s+([0-9,]+(?:\.[0-9]{1,2})?)\s*원?\s*$/,
    
    // 7. "시간 상점명 금액" 형태
    /^(?:\d{1,2}:\d{2}|\d{1,2}시)\s+(.+?)\s+([0-9,]+(?:\.[0-9]{1,2})?)\s*원?\s*$/
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      let description = '';
      let amount = '';
      
      // 패턴에 따라 설명과 금액 추출
      if (pattern === patterns[3]) { // "금액 상품명" 형태
        amount = match[1];
        description = match[2];
      } else {
        description = match[1];
        amount = match[2];
      }
      
      // 설명과 금액 유효성 검사
      if (isValidDescription(description) && isValidAmount(amount)) {
        return {
          amount: formatAmount(amount),
          description: cleanDescription(description),
          originalText: line,
          confidence: 0.8
        };
      }
    }
  }
  
  return null;
};

// 두 라인을 조합해서 지출 항목 추출 (설명과 금액이 분리된 경우)
const extractExpenseFromCombinedLines = (line1: string, line2: string): ExpenseItem | null => {
  // 첫 번째 라인이 설명, 두 번째 라인이 금액인 경우
  const amountMatch = line2.match(/^([0-9,]+(?:\.[0-9]{1,2})?)\s*원?\s*$/);
  if (amountMatch && isValidDescription(line1) && isValidAmount(amountMatch[1])) {
    return {
      amount: formatAmount(amountMatch[1]),
      description: cleanDescription(line1),
      originalText: `${line1} ${line2}`,
      confidence: 0.7
    };
  }
  
  // 첫 번째 라인이 금액, 두 번째 라인이 설명인 경우
  const firstLineAmountMatch = line1.match(/^([0-9,]+(?:\.[0-9]{1,2})?)\s*원?\s*$/);
  if (firstLineAmountMatch && isValidDescription(line2) && isValidAmount(firstLineAmountMatch[1])) {
    return {
      amount: formatAmount(firstLineAmountMatch[1]),
      description: cleanDescription(line2),
      originalText: `${line1} ${line2}`,
      confidence: 0.7
    };
  }
  
  return null;
};

// 설명 유효성 검사
const isValidDescription = (description: string): boolean => {
  if (!description || description.length < 2 || description.length > 50) {
    return false;
  }
  
  // 숫자나 특수문자만 있는 경우 제외
  if (/^[0-9\s\-.:,₩$]+$/.test(description)) {
    return false;
  }
  
  // 전화번호나 계좌번호 같은 패턴 제외
  if (/^\d{3,4}-?\d{3,4}-?\d{4}$/.test(description)) {
    return false;
  }
  
  return true;
};

// 금액 유효성 검사
const isValidAmount = (amount: string): boolean => {
  const numValue = parseFloat(amount.replace(/,/g, ''));
  return !isNaN(numValue) && numValue >= 10 && numValue <= 10000000;
};

// 설명 정리
const cleanDescription = (description: string): string => {
  return description
    .replace(/^\s*[-*•·]\s*/, '') // 앞의 불릿 포인트 제거
    .replace(/\s+/g, ' ') // 연속 공백을 하나로
    .trim();
};

// 금액 포맷팅
const formatAmount = (amount: string): string => {
  const numValue = parseFloat(amount.replace(/,/g, ''));
  return numValue >= 1000 ? numValue.toLocaleString() : numValue.toString();
};

// 중복 항목 제거
const removeDuplicateItems = (items: ExpenseItem[]): ExpenseItem[] => {
  const seen = new Set<string>();
  const unique: ExpenseItem[] = [];
  
  for (const item of items) {
    const key = `${item.amount}_${item.description}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  
  return unique;
};

// 영수증 특성 기반 고급 필터링 (새로 추가)
const analyzeReceiptPattern = (text: string): {
  totalAmount: string | null;
  confidence: number;
  reasoning: string[];
} => {
  console.log('=== Receipt Pattern Analysis ===');
  
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const reasoning: string[] = [];
  let totalAmount: string | null = null;
  let confidence = 0;
  
  // 1. 총액/합계 키워드 우선 검색
  const totalKeywords = ['합계', '총액', '총계', '결제금액', '청구금액', 'total', 'amount', 'sum', 'subtotal'];
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    for (const keyword of totalKeywords) {
      if (lineLower.includes(keyword)) {
        const amounts = extractAmountsFromLine(line);
        if (amounts.length > 0) {
          const amount = amounts[0];
          if (amount >= 100 && amount <= 1000000) { // 합리적인 범위
            totalAmount = amount.toLocaleString();
            confidence = 90;
            reasoning.push(`총액 키워드 '${keyword}' 발견: ${totalAmount}원`);
            return { totalAmount, confidence, reasoning };
          }
        }
      }
    }
  }
  
  // 2. 부가세 기반 추정
  const vatAmount = findVATAmount(lines);
  if (vatAmount > 0) {
    const estimatedTotal = Math.round(vatAmount * 11); // 부가세 10% 역산
    if (estimatedTotal >= 100 && estimatedTotal <= 1000000) {
      totalAmount = estimatedTotal.toLocaleString();
      confidence = 80;
      reasoning.push(`부가세 ${vatAmount.toLocaleString()}원으로부터 추정: ${totalAmount}원`);
      return { totalAmount, confidence, reasoning };
    }
  }
  
  // 3. 최종 라인 분석 (영수증의 마지막 부분에 총액이 오는 경우가 많음)
  const lastFewLines = lines.slice(-5); // 마지막 5줄 분석
  const candidateAmounts: Array<{amount: number, line: string, score: number}> = [];
  
  for (const line of lastFewLines) {
    if (shouldSkipLine(line)) continue;
    
    const amounts = extractAmountsFromLine(line);
    for (const amount of amounts) {
      if (amount >= 100 && amount <= 1000000) {
        let score = 50;
        
        // 마지막 라인에 가까울수록 점수 증가
        const lineIndex = lastFewLines.indexOf(line);
        score += (lineIndex + 1) * 10;
        
        // 원화 표시가 있으면 점수 증가
        if (line.includes('원') || line.includes('₩')) {
          score += 20;
        }
        
        // 적절한 가격 범위 점수
        if (amount >= 1000 && amount <= 100000) {
          score += 15;
        }
        
        candidateAmounts.push({ amount, line, score });
      }
    }
  }
  
  // 점수가 높은 순으로 정렬
  candidateAmounts.sort((a, b) => b.score - a.score);
  
  if (candidateAmounts.length > 0) {
    const best = candidateAmounts[0];
    totalAmount = best.amount.toLocaleString();
    confidence = Math.min(best.score, 75); // 최대 75점
    reasoning.push(`영수증 하단 분석: ${totalAmount}원 (점수: ${best.score})`);
  }
  
  return { totalAmount, confidence, reasoning };
};

// 부가세 금액 찾기 (새로 추가)
const findVATAmount = (lines: string[]): number => {
  const vatKeywords = ['부가세', '세액', 'vat', 'tax'];
  
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    for (const keyword of vatKeywords) {
      if (lineLower.includes(keyword)) {
        const amounts = extractAmountsFromLine(line);
        if (amounts.length > 0) {
          const vatAmount = amounts[0];
          // 부가세는 보통 100원 이상 100,000원 이하
          if (vatAmount >= 100 && vatAmount <= 100000) {
            return vatAmount;
          }
        }
      }
    }
  }
  
  return 0;
};

// 건너뛸 라인 판단 (새로 추가)
const shouldSkipLine = (line: string): boolean => {
  const lineLower = line.toLowerCase();
  
  // 확실히 건너뛸 키워드들
  const skipKeywords = [
    // 카드/계좌 정보
    '카드번호', 'card number', '계좌번호', 'account',
    // 영수증 정보
    '영수증번호', 'receipt', '주문번호', 'order',
    // 매장 정보
    '매장', 'store', '지점', 'branch',
    // 시간 정보
    '시간', 'time', '일시', 'date',
    // 연락처
    '전화', 'tel', 'phone',
    // 사업자 정보
    '사업자', 'business'
  ];
  
  return skipKeywords.some(keyword => lineLower.includes(keyword));
};

// 영수증 품목 분석 개선 (새로 추가)
const analyzeReceiptItems = (text: string): ExpenseItem[] => {
  console.log('=== Enhanced Receipt Items Analysis ===');
  
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const detectedItems: ExpenseItem[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (shouldSkipLine(line)) continue;
    
    // 1. 단일 라인에서 "품목명 + 금액" 패턴
    const singleLineItem = analyzeSingleLineItem(line);
    if (singleLineItem) {
      detectedItems.push(singleLineItem);
      continue;
    }
    
    // 2. 멀티라인 패턴 (품목명과 금액이 분리된 경우)
    if (i < lines.length - 1) {
      const nextLine = lines[i + 1].trim();
      const multiLineItem = analyzeMultiLineItem(line, nextLine);
      if (multiLineItem) {
        detectedItems.push(multiLineItem);
        i++; // 다음 라인 건너뛰기
        continue;
      }
    }
    
    // 3. 테이블 형태 패턴 (품목 | 수량 | 가격)
    const tableItem = analyzeTableItem(line);
    if (tableItem) {
      detectedItems.push(tableItem);
    }
  }
  
  // 중복 제거 및 정렬
  const uniqueItems = removeDuplicateItems(detectedItems);
  
  // 금액 크기순으로 정렬
  uniqueItems.sort((a, b) => {
    const amountA = parseFloat(a.amount.replace(/[^0-9.]/g, ''));
    const amountB = parseFloat(b.amount.replace(/[^0-9.]/g, ''));
    return amountB - amountA;
  });
  
  console.log('Enhanced analyzed items:', uniqueItems);
  return uniqueItems.slice(0, 10); // 최대 10개
};

// 단일 라인 품목 분석 (새로 추가)
const analyzeSingleLineItem = (line: string): ExpenseItem | null => {
  // 다양한 패턴 매칭
  const patterns = [
    // 한국 영수증 패턴: "품목명 금액원"
    /^(.+?)\s+([0-9,]+)\s*원?\s*$/,
    // 한국 영수증 패턴: "품목명 x수량 금액원"
    /^(.+?)\s+x?(\d+)?\s*([0-9,]+)\s*원?\s*$/,
    // 국제 패턴: "품목명 $금액"
    /^(.+?)\s+\$([0-9,]+(?:\.[0-9]{2})?)\s*$/,
    // 국제 패턴: "품목명 금액"
    /^(.+?)\s+([0-9,]+(?:\.[0-9]{2})?)\s*$/,
    // 역순 패턴: "금액 품목명"
    /^([0-9,]+(?:\.[0-9]{2})?)\s*원?\s+(.+)$/
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = line.match(pattern);
    
    if (match) {
      let description = '';
      let amount = '';
      
      if (i === patterns.length - 1) { // 역순 패턴
        amount = match[1];
        description = match[2];
      } else {
        description = match[1];
        // 수량이 있는 경우 (패턴 2)
        if (i === 1 && match[2]) {
          amount = match[3];
          description = `${description} (${match[2]}개)`;
        } else {
          amount = match[2] || match[3];
        }
      }
      
      if (isValidReceiptItem(description, amount)) {
        return {
          amount: formatAmount(amount),
          description: cleanDescription(description),
          originalText: line,
          confidence: 0.85
        };
      }
    }
  }
  
  return null;
};

// 멀티라인 품목 분석 (새로 추가)
const analyzeMultiLineItem = (line1: string, line2: string): ExpenseItem | null => {
  // 첫 번째 라인이 품목명, 두 번째 라인이 금액인 경우
  const amountMatch = line2.match(/^([0-9,]+(?:\.[0-9]{2})?)\s*원?\s*$/);
  if (amountMatch && isValidReceiptItem(line1, amountMatch[1])) {
    return {
      amount: formatAmount(amountMatch[1]),
      description: cleanDescription(line1),
      originalText: `${line1} ${line2}`,
      confidence: 0.75
    };
  }
  
  return null;
};

// 테이블 형태 품목 분석 (새로 추가)
const analyzeTableItem = (line: string): ExpenseItem | null => {
  // 테이블 구분자들: |, \t, 연속 공백
  const separators = [/\s*\|\s*/, /\t+/, /\s{3,}/];
  
  for (const separator of separators) {
    const parts = line.split(separator);
    if (parts.length >= 2) {
      // 마지막 부분이 금액인지 확인
      const lastPart = parts[parts.length - 1].trim();
      const amountMatch = lastPart.match(/^([0-9,]+(?:\.[0-9]{2})?)\s*원?\s*$/);
      
      if (amountMatch) {
        const description = parts.slice(0, -1).join(' ').trim();
        if (isValidReceiptItem(description, amountMatch[1])) {
          return {
            amount: formatAmount(amountMatch[1]),
            description: cleanDescription(description),
            originalText: line,
            confidence: 0.8
          };
        }
      }
    }
  }
  
  return null;
};

// 영수증 품목 유효성 검사 (새로 추가)
const isValidReceiptItem = (description: string, amount: string): boolean => {
  if (!description || !amount) return false;
  
  // 설명 검사
  if (description.length < 2 || description.length > 100) return false;
  
  // 숫자만 있는 설명 제외
  if (/^\d+$/.test(description.trim())) return false;
  
  // 금액 검사
  const numAmount = parseFloat(amount.replace(/,/g, ''));
  if (isNaN(numAmount) || numAmount < 10 || numAmount > 10000000) return false;
  
  // 제외할 키워드들
  const excludeKeywords = [
    '합계', '총액', '총계', '부가세', '세액',
    '카드번호', '전화번호', '사업자번호',
    'total', 'subtotal', 'tax', 'vat'
  ];
  
  const descLower = description.toLowerCase();
  return !excludeKeywords.some(keyword => descLower.includes(keyword));
};

// OCR 정확도 향상을 위한 추가 기능들

// 1. 영수증 타입 감지 및 특화 분석 (새로 추가)
const detectReceiptType = (text: string): {
  type: 'restaurant' | 'retail' | 'online' | 'cafe' | 'gas_station' | 'pharmacy' | 'general';
  confidence: number;
  keywords: string[];
} => {
  const textLower = text.toLowerCase();
  
  const typePatterns = {
    restaurant: {
      keywords: ['음식점', '식당', '레스토랑', 'restaurant', '주문', 'order', '테이블', 'table', '서비스료'],
      confidence: 0
    },
    cafe: {
      keywords: ['커피', 'coffee', '카페', 'cafe', '스타벅스', '이디야', '투썸', '아메리카노', '라떼'],
      confidence: 0
    },
    retail: {
      keywords: ['마트', '편의점', '이마트', '롯데마트', 'gs25', 'cu', '세븐일레븐', '상품'],
      confidence: 0
    },
    online: {
      keywords: ['배송', '택배', '온라인', 'online', '쿠팡', '네이버', '11번가', '배송료'],
      confidence: 0
    },
    gas_station: {
      keywords: ['주유소', 'gs칼텍스', 'sk에너지', '현대오일뱅크', '휘발유', '경유', '리터'],
      confidence: 0
    },
    pharmacy: {
      keywords: ['약국', 'pharmacy', '의약품', '처방전', '약사'],
      confidence: 0
    }
  };
  
  let detectedType: keyof typeof typePatterns | 'general' = 'general';
  let maxConfidence = 0;
  let matchedKeywords: string[] = [];
  
  for (const [type, data] of Object.entries(typePatterns)) {
    let confidence = 0;
    const foundKeywords: string[] = [];
    
    for (const keyword of data.keywords) {
      if (textLower.includes(keyword)) {
        confidence += 1;
        foundKeywords.push(keyword);
      }
    }
    
    if (confidence > maxConfidence) {
      maxConfidence = confidence;
      detectedType = type as keyof typeof typePatterns;
      matchedKeywords = foundKeywords;
    }
  }
  
  return {
    type: detectedType,
    confidence: Math.min(maxConfidence / 3, 1), // 정규화
    keywords: matchedKeywords
  };
};

// 2. 타입별 특화 분석 (새로 추가)
const analyzeByReceiptType = (text: string, receiptType: string): {
  amount: string | null;
  confidence: number;
  items: ExpenseItem[];
} => {
  console.log(`=== Type-specific analysis for: ${receiptType} ===`);
  
  switch (receiptType) {
    case 'restaurant':
      return analyzeRestaurantReceipt(text);
    case 'cafe':
      return analyzeCafeReceipt(text);
    case 'retail':
      return analyzeRetailReceipt(text);
    case 'gas_station':
      return analyzeGasStationReceipt(text);
    default:
      return {
        amount: null,
        confidence: 0,
        items: []
      };
  }
};

// 3. 식당 영수증 특화 분석 (새로 추가)
const analyzeRestaurantReceipt = (text: string): {
  amount: string | null;
  confidence: number;
  items: ExpenseItem[];
} => {
  const lines = text.split('\n');
  const items: ExpenseItem[] = [];
  let totalAmount: string | null = null;
  let confidence = 0;
  
  // 식당 특화 키워드
  const serviceChargeKeywords = ['서비스료', 'service charge'];
  const totalKeywords = ['합계', '총계', '결제금액', '청구액'];
  
  for (const line of lines) {
    // 메뉴 항목 패턴 (한국 식당)
    const menuPattern = /^(.+?)\s+(\d+)개?\s*([0-9,]+)\s*원?\s*$/;
    const match = line.match(menuPattern);
    
    if (match) {
      const [, name, quantity, price] = match;
      if (isValidReceiptItem(name, price)) {
        items.push({
          amount: formatAmount(price),
          description: `${cleanDescription(name)} (${quantity}개)`,
          originalText: line,
          confidence: 0.9
        });
      }
    }
    
    // 총액 찾기
    for (const keyword of totalKeywords) {
      if (line.toLowerCase().includes(keyword)) {
        const amounts = extractAmountsFromLine(line);
        if (amounts.length > 0 && amounts[0] >= 1000) {
          totalAmount = amounts[0].toLocaleString();
          confidence = 0.95;
        }
      }
    }
  }
  
  return { amount: totalAmount, confidence, items };
};

// 4. 카페 영수증 특화 분석 (새로 추가)
const analyzeCafeReceipt = (text: string): {
  amount: string | null;
  confidence: number;
  items: ExpenseItem[];
} => {
  const lines = text.split('\n');
  const items: ExpenseItem[] = [];
  let totalAmount: string | null = null;
  let confidence = 0;
  
  const drinkKeywords = ['아메리카노', '라떼', '카푸치노', '프라푸치노', '에스프레소', '마키아토'];
  const sizeKeywords = ['tall', 'grande', 'venti', '소', '중', '대', 'small', 'medium', 'large'];
  
  for (const line of lines) {
    // 음료 주문 패턴
    const lineLower = line.toLowerCase();
    const isDrink = drinkKeywords.some(keyword => lineLower.includes(keyword));
    
    if (isDrink) {
      const amounts = extractAmountsFromLine(line);
      if (amounts.length > 0) {
        items.push({
          amount: formatAmount(amounts[0].toString()),
          description: cleanDescription(line.split(/[0-9,]+/)[0].trim()),
          originalText: line,
          confidence: 0.9
        });
      }
    }
    
    // 총액 (카페는 보통 간단한 구조)
    if (lineLower.includes('total') || lineLower.includes('합계')) {
      const amounts = extractAmountsFromLine(line);
      if (amounts.length > 0) {
        totalAmount = amounts[0].toLocaleString();
        confidence = 0.9;
      }
    }
  }
  
  return { amount: totalAmount, confidence, items };
};

// 5. 마트/편의점 영수증 특화 분석 (새로 추가)
const analyzeRetailReceipt = (text: string): {
  amount: string | null;
  confidence: number;
  items: ExpenseItem[];
} => {
  const lines = text.split('\n');
  const items: ExpenseItem[] = [];
  let totalAmount: string | null = null;
  let confidence = 0;
  
  for (const line of lines) {
    // 상품 바코드 패턴 (보통 바코드 다음에 상품명과 가격)
    const barcodePattern = /^\d{8,13}\s+(.+?)\s+([0-9,]+)\s*원?\s*$/;
    const simplePattern = /^(.+?)\s+([0-9,]+)\s*원?\s*$/;
    
    let match = line.match(barcodePattern) || line.match(simplePattern);
    
    if (match) {
      const [, name, price] = match;
      if (isValidReceiptItem(name, price)) {
        items.push({
          amount: formatAmount(price),
          description: cleanDescription(name),
          originalText: line,
          confidence: 0.85
        });
      }
    }
    
    // 마트 총액 키워드
    const totalKeywords = ['소계', '합계', '받을금액', '결제금액'];
    for (const keyword of totalKeywords) {
      if (line.includes(keyword)) {
        const amounts = extractAmountsFromLine(line);
        if (amounts.length > 0) {
          totalAmount = amounts[0].toLocaleString();
          confidence = 0.9;
        }
      }
    }
  }
  
  return { amount: totalAmount, confidence, items };
};

// 6. 주유소 영수증 특화 분석 (새로 추가)
const analyzeGasStationReceipt = (text: string): {
  amount: string | null;
  confidence: number;
  items: ExpenseItem[];
} => {
  const lines = text.split('\n');
  const items: ExpenseItem[] = [];
  let totalAmount: string | null = null;
  let confidence = 0;
  
  for (const line of lines) {
    // 주유 정보 패턴: "휘발유 20.5L 단가1,500 금액30,750"
    const fuelPattern = /(휘발유|경유|등유|LPG)\s*([0-9.]+)\s*L?\s*.*?([0-9,]+)\s*원?\s*$/i;
    const match = line.match(fuelPattern);
    
    if (match) {
      const [, fuelType, liters, amount] = match;
      items.push({
        amount: formatAmount(amount),
        description: `${fuelType} ${liters}L`,
        originalText: line,
        confidence: 0.95
      });
      
      // 주유소는 보통 단일 항목이므로 이것이 총액
      totalAmount = formatAmount(amount);
      confidence = 0.95;
    }
  }
  
  return { amount: totalAmount, confidence, items };
};

// 7. 사용자 피드백 학습 시스템 (새로 추가)
interface UserFeedback {
  originalText: string;
  expectedAmount: string;
  expectedItems: ExpenseItem[];
  feedback: 'correct' | 'incorrect' | 'partial';
  timestamp: number;
}

// 로컬 스토리지에서 피드백 데이터 관리
const saveFeedback = async (feedback: UserFeedback): Promise<void> => {
  try {
    // React Native AsyncStorage 또는 웹 localStorage 사용
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = localStorage.getItem('ocr_feedback') || '[]';
      const feedbacks: UserFeedback[] = JSON.parse(existing);
      feedbacks.push(feedback);
      localStorage.setItem('ocr_feedback', JSON.stringify(feedbacks.slice(-100))); // 최근 100개만 유지
    }
  } catch (error) {
    console.error('Failed to save feedback:', error);
  }
};

const getFeedbackHistory = async (): Promise<UserFeedback[]> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = localStorage.getItem('ocr_feedback') || '[]';
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load feedback:', error);
  }
  return [];
};

// 8. 적응형 신뢰도 조정 (새로 추가)
const adjustConfidenceBasedOnHistory = async (
  currentResult: OCRResult,
  textPattern: string
): Promise<number> => {
  const history = await getFeedbackHistory();
  
  // 유사한 패턴의 과거 피드백 찾기
  const similarFeedbacks = history.filter(feedback => {
    const similarity = calculateTextSimilarity(feedback.originalText, textPattern);
    return similarity > 0.7;
  });
  
  if (similarFeedbacks.length === 0) {
    return currentResult.confidence || 0.8;
  }
  
  // 과거 정확도 기반으로 신뢰도 조정
  const correctCount = similarFeedbacks.filter(f => f.feedback === 'correct').length;
  const accuracyRate = correctCount / similarFeedbacks.length;
  
  return Math.min((currentResult.confidence || 0.8) * (0.5 + accuracyRate), 0.95);
};

// 텍스트 유사도 계산 (간단한 구현)
const calculateTextSimilarity = (text1: string, text2: string): number => {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];
  
  return intersection.length / union.length;
};

// 9. 신뢰도 기반 결과 통합 (새로 추가)
const integrateAnalysisResults = (
  basicResult: OCRResult,
  receiptAnalysis: any,
  typeAnalysis: any
): OCRResult => {
  console.log('=== Integrating Analysis Results ===');
  
  // 가장 높은 신뢰도의 결과 선택
  const candidates = [
    { amount: basicResult.amount, confidence: basicResult.confidence || 0.5, source: 'basic' },
    { amount: receiptAnalysis.totalAmount, confidence: receiptAnalysis.confidence / 100, source: 'pattern' },
    { amount: typeAnalysis.amount, confidence: typeAnalysis.confidence, source: 'type' }
  ].filter(c => c.amount);
  
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  const bestResult = candidates[0];
  console.log('Best result selected:', bestResult);
  
  return {
    ...basicResult,
    amount: bestResult?.amount || basicResult.amount,
    confidence: bestResult?.confidence || basicResult.confidence,
    expenseItems: typeAnalysis.items.length > 0 ? typeAnalysis.items : basicResult.expenseItems
  };
};

// Clova OCR API 호출
export const processImageWithClovaOCR = async (imageUri: string): Promise<OCRResult> => {
  try {
    console.log('=== OCR Service Started ===');
    console.log('Input imageUri:', imageUri);
    console.log('Platform:', Platform.OS);

    // API 설정 검증
    if (!CLOVA_OCR_CONFIG.secretKey || !CLOVA_OCR_CONFIG.apiUrl) {
      console.warn('OCR API 설정이 없습니다. 환경변수를 확인해주세요.');
      
      // 개발 환경에서는 목 데이터 반환
      if (__DEV__) {
        console.log('개발 환경에서 목 OCR 데이터를 반환합니다.');
        // 실제 OCR 처리 시간을 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
          amount: '15,000',
          description: 'OCR 테스트 영수증',
          rawText: 'OCR API 설정이 없어 테스트 데이터를 반환합니다.\n스타벅스 커피\n아메리카노 5,500\n케이크 12,000\n부가세 1,750\n총액 15,000원',
          confidence: 0.85,
          candidateNumbers: ['15,000', '12,000', '5,500', '1,750', '2024', '1234'],
          expenseItems: [
            {
              amount: '15,000',
              description: '스타벅스 커피 (총액)',
              originalText: '총액 15,000원',
              confidence: 0.9
            },
            {
              amount: '12,000',
              description: '케이크',
              originalText: '케이크 12,000',
              confidence: 0.8
            },
            {
              amount: '5,500',
              description: '아메리카노',
              originalText: '아메리카노 5,500',
              confidence: 0.8
            },
            {
              amount: '1,750',
              description: '부가세',
              originalText: '부가세 1,750',
              confidence: 0.7
            }
          ]
        };
      }
      
      throw new Error('OCR API 설정이 올바르지 않습니다. 환경변수를 확인해주세요.');
    }

    console.log('Converting image to Base64...');
    
    // 이미지를 Base64로 변환 (안전성 개선)
    let base64Image: string;
    try {
      base64Image = await imageToBase64(imageUri);
      console.log('Base64 conversion completed. Length:', base64Image.length);
      
      if (!base64Image || base64Image.length < 100) {
        throw new Error('이미지 변환 결과가 유효하지 않습니다.');
      }
    } catch (conversionError) {
      console.error('Image conversion failed:', conversionError);
      throw new Error('이미지를 처리할 수 없습니다. 다른 이미지를 선택해주세요.');
    }
    
    // 이미지 형식 감지
    const imageFormat = getImageFormat(imageUri);
    console.log('Detected image format:', imageFormat);
    
    // Clova OCR API 요청 데이터 (일반 문서 OCR 형식)
    const requestData = {
      images: [
        {
          format: imageFormat,
          name: 'receipt_image',
          data: base64Image,
        },
      ],
      requestId: `receipt_${Date.now()}`,
      version: 'V2',
      timestamp: Date.now(),
      lang: 'ko', // 한국어 설정
    };

    console.log('=== Sending OCR Request ===');
    console.log('Request URL:', CLOVA_OCR_CONFIG.apiUrl);
    console.log('Request data (without image):', {
      ...requestData,
      images: [{ ...requestData.images[0], data: '[BASE64_DATA_HIDDEN]' }]
    });

    // API 호출 (타임아웃 설정)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    let response: Response;
    try {
      response = await fetch(CLOVA_OCR_CONFIG.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OCR-SECRET': CLOVA_OCR_CONFIG.secretKey,
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error('Fetch error:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        throw new Error('OCR 처리 시간이 초과되었습니다. 다시 시도해주세요.');
      } else if (fetchError.message?.includes('CORS')) {
        throw new Error('웹에서는 OCR 기능이 제한됩니다. 모바일 앱에서 사용해주세요.');
      } else if (fetchError.message?.includes('Failed to fetch')) {
        throw new Error('네트워크 연결을 확인하고 다시 시도해주세요.');
      } else {
        throw new Error('OCR 서비스에 연결할 수 없습니다: ' + fetchError.message);
      }
    }

    console.log('=== OCR Response Received ===');
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      console.error('OCR API error:', response.status, response.statusText);
      
      let errorMessage = 'OCR 처리에 실패했습니다.';
      if (response.status === 401) {
        errorMessage = 'OCR API 인증에 실패했습니다. API 키를 확인해주세요.';
      } else if (response.status === 403) {
        errorMessage = 'OCR API 접근 권한이 없습니다.';
      } else if (response.status === 429) {
        errorMessage = 'OCR API 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
      } else if (response.status >= 500) {
        errorMessage = 'OCR 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('=== OCR Result Received ===');
    console.log('Full OCR result:', JSON.stringify(result, null, 2));

    // OCR 결과에서 텍스트 추출 (안정성 개선)
    let extractedText = '';
    let templateAmount = '';
    let templateStoreName = '';
    
    try {
      // 다양한 응답 구조에 대응
      if (result.images && result.images[0]) {
        const image = result.images[0];
        
        // 템플릿 기반 응답 처리
        if (image.fields && Array.isArray(image.fields)) {
          console.log('Processing template-based OCR response...');
          console.log('Number of fields:', image.fields.length);
          
          for (const field of image.fields) {
            console.log('Field:', field);
            if (field.inferText) {
              extractedText += field.inferText + '\n';
              
              // 템플릿에서 지정한 필드명으로 데이터 추출
              if (field.name === 'total_amount') {
                templateAmount = field.inferText;
                console.log('Found template amount:', templateAmount);
              }
              if (field.name === 'store_name') {
                templateStoreName = field.inferText;
                console.log('Found template store name:', templateStoreName);
              }
            }
          }
        }
        
        // 일반 문서 OCR 응답 처리
        else if (image.text && Array.isArray(image.text)) {
          console.log('Processing general document OCR response...');
          console.log('Number of text blocks:', image.text.length);
          
          for (const textBlock of image.text) {
            if (textBlock.inferText) {
              extractedText += textBlock.inferText + '\n';
            }
          }
        }
        
        // convertedImageInfo 처리 (fallback)
        else if (image.convertedImageInfo && image.convertedImageInfo.text) {
          console.log('Processing convertedImageInfo...');
          extractedText = image.convertedImageInfo.text;
        }
      }
      
      console.log('=== Text Extraction Completed ===');
      console.log('Extracted text length:', extractedText.length);
      console.log('Extracted text preview:', extractedText.substring(0, 200));
    } catch (extractionError) {
      console.error('Text extraction error:', extractionError);
      extractedText = 'OCR 텍스트 추출 중 오류가 발생했습니다.';
    }

    // 최종 결과 생성
    const finalAmount = templateAmount || extractSmartPriceFromText(extractedText) || '';
    const finalDescription = templateStoreName || extractDescriptionFromText(extractedText) || '';
    
    const ocrResult: OCRResult = {
      amount: finalAmount,
      description: finalDescription,
      rawText: extractedText,
      confidence: extractedText ? 0.8 : 0.1, // 텍스트가 있으면 기본 신뢰도 0.8
      candidateNumbers: extractCandidateNumbers(extractedText),
      expenseItems: analyzeReceiptItems(extractedText),
    };

    console.log('=== Final OCR Result ===');
    console.log('Amount:', ocrResult.amount);
    console.log('Description:', ocrResult.description);
    console.log('Confidence:', ocrResult.confidence);

    return ocrResult;

  } catch (error: any) {
    console.error('=== OCR Service Error ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);

    // 사용자에게 의미있는 오류 메시지 제공
    const userFriendlyMessage = error.message || 'OCR 처리 중 알 수 없는 오류가 발생했습니다.';
    
    // 기본 fallback 결과 반환 (완전 실패 방지)
    const fallbackResult: OCRResult = {
      amount: undefined,
      description: '영수증',
      rawText: `OCR 처리 실패: ${userFriendlyMessage}`,
      confidence: 0,
    };

    console.log('Returning fallback result:', fallbackResult);
    
    // 오류를 다시 throw하여 호출자가 처리할 수 있도록 함
    throw new Error(userFriendlyMessage);
  }
};

// 개발/테스트용 Mock OCR (실제 API 사용이 어려운 경우)
export const mockOCR = async (imageUri: string): Promise<OCRResult> => {
  // 실제 개발 시에는 이 함수 대신 processImageWithClovaOCR 사용
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    amount: '25.50',
    description: '스타벅스 커피',
    rawText: '스타벅스 커피\n아메리카노\n25.50$\n총액: 25.50$',
    confidence: 0.95,
    candidateNumbers: ['25.50', '15.00', '10.50', '5000', '1234']
  };
}; 