import { Platform } from 'react-native';

// Naver Clova OCR API 설정
const CLOVA_OCR_CONFIG = {
  secretKey: 'RUh3UkpReVVSeWVkTHRYS2pZbnFkdm11Tm5BYUtHTm8=',
  apiUrl: 'https://suz0e9o2x4.apigw.ntruss.com/custom/v1/42611/34a389d790fc2bdd8458e5f1cde6933c97d11eeda65cf328b64460f0d68f04b5/infer'
};

export interface OCRResult {
  amount?: string;
  description?: string;
  rawText: string;
  confidence?: number;
}

// 가격 패턴 매칭 (다양한 형태의 가격 인식)
const extractPriceFromText = (text: string): string | null => {
  // 다양한 가격 패턴
  const pricePatterns = [
    // 기본 숫자 + 원/$ 패턴
    /(?:합계|총액|총계|금액|결제|TOTAL|Total|total)?\s*:?\s*([0-9,]+(?:\.[0-9]{2})?)\s*(?:원|₩|\$|USD|KRW)/gi,
    // 단순 숫자 패턴 (큰 금액)
    /([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?)/g,
    // 소수점 포함 가격
    /([0-9]+\.[0-9]{2})/g,
    // 한국 원화 패턴
    /([0-9,]+)\s*원/g,
    // 달러 패턴
    /\$\s*([0-9,]+(?:\.[0-9]{2})?)/g,
  ];

  const amounts: number[] = [];

  for (const pattern of pricePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const amountStr = match[1]?.replace(/,/g, '') || match[0]?.replace(/[^0-9.]/g, '');
      if (amountStr) {
        const amount = parseFloat(amountStr);
        if (amount > 0 && amount < 1000000) { // 합리적인 범위의 금액
          amounts.push(amount);
        }
      }
    }
  }

  // 가장 큰 금액을 총액으로 간주 (일반적으로 영수증에서 총액이 가장 큰 값)
  if (amounts.length > 0) {
    const maxAmount = Math.max(...amounts);
    return maxAmount.toFixed(2);
  }

  return null;
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
  if (Platform.OS === 'web') {
    // 웹에서는 File API 사용
    const response = await fetch(imageUri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]); // data:image/jpeg;base64, 부분 제거
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    // React Native에서는 FileSystem 사용
    try {
      const FileSystem = require('expo-file-system');
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (error) {
      console.error('Failed to convert image to base64:', error);
      throw new Error('이미지 변환에 실패했습니다.');
    }
  }
};

// Clova OCR API 호출
export const processImageWithClovaOCR = async (imageUri: string): Promise<OCRResult> => {
  try {
    console.log('Starting OCR processing for image:', imageUri);

    // 이미지를 Base64로 변환
    const base64Image = await imageToBase64(imageUri);
    
    // Clova OCR API 요청 데이터
    const requestData = {
      images: [
        {
          format: 'jpg', // 또는 'png'
          name: 'receipt',
          data: base64Image
        }
      ],
      requestId: `receipt_${Date.now()}`,
      version: 'V2',
      timestamp: Date.now()
    };

    console.log('Sending request to Clova OCR API...');

    const response = await fetch(CLOVA_OCR_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OCR-SECRET': CLOVA_OCR_CONFIG.secretKey,
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OCR API Error:', response.status, errorText);
      throw new Error(`OCR API 오류: ${response.status}`);
    }

    const result = await response.json();
    console.log('OCR API Response:', result);

    // OCR 결과에서 텍스트 추출
    let extractedText = '';
    if (result.images && result.images[0] && result.images[0].fields) {
      extractedText = result.images[0].fields
        .map((field: any) => field.inferText)
        .join('\n');
    }

    console.log('Extracted text from OCR:', extractedText);

    // 텍스트에서 가격과 설명 추출
    const amount = extractPriceFromText(extractedText);
    const description = extractDescriptionFromText(extractedText);

    const ocrResult: OCRResult = {
      amount: amount || undefined,
      description: description || '영수증',
      rawText: extractedText,
      confidence: result.images?.[0]?.fields?.[0]?.inferConfidence || 0
    };

    console.log('Final OCR result:', ocrResult);
    return ocrResult;

  } catch (error: any) {
    console.error('OCR processing failed:', error);
    
    // 에러가 발생해도 기본값 반환
    return {
      amount: undefined,
      description: '영수증',
      rawText: `OCR 처리 중 오류 발생: ${error.message}`,
      confidence: 0
    };
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
    confidence: 0.95
  };
}; 