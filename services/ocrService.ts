import { Platform } from 'react-native';

// OCR API 설정 (환경변수 또는 설정 파일에서 가져와야 함)
const OCR_API_URL = 'https://naveropenapi.apigw.ntruss.com/custom/v1/20942/bb9838b999b1cafc5e35e34d9e98b0b6a2b3b1d9a8e9b0c7e9b4b7e9c0a1/document/receipt';
const OCR_SECRET_KEY = 'RUh3UkpReVVSeWVkTHRYS2pZbnFkdm11Tm5BYUtHTm8='; // 실제 시크릿 키로 교체 필요

interface OCRResult {
  amount?: number;
  currency?: string;
  confidence?: number;
  rawText?: string;
}

interface NaverOCRResponse {
  version: string;
  requestId: string;
  timestamp: number;
  images: Array<{
    receipt: {
      result: {
        storeInfo?: {
          name?: { text: string };
          bizNum?: { text: string };
          addresses?: Array<{ text: string }>;
        };
        paymentInfo?: {
          date?: { text: string };
          time?: { text: string };
          cardInfo?: {
            company?: { text: string };
            number?: { text: string };
          };
        };
        totalPrice?: {
          price?: { text: string; formatted?: { value: number } };
        };
        subResults?: Array<{
          items?: Array<{
            name?: { text: string };
            count?: { text: string };
            price?: { text: string; formatted?: { value: number } };
          }>;
        }>;
      };
    };
  }>;
}

export const extractAmountFromReceipt = async (imageUri: string): Promise<OCRResult> => {
  try {
    // 이미지를 Base64로 변환
    const imageBase64 = await convertImageToBase64(imageUri);
    
    // OCR API 요청
    const requestBody = {
      images: [
        {
          format: 'jpg',
          name: 'receipt',
          data: imageBase64,
        }
      ],
      requestId: `receipt_${Date.now()}`,
      version: 'V2',
      timestamp: Date.now(),
    };

    const response = await fetch(OCR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OCR-SECRET': OCR_SECRET_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`OCR API request failed: ${response.status}`);
    }

    const ocrData: NaverOCRResponse = await response.json();
    
    // OCR 결과에서 금액 정보 추출
    return parseOCRResult(ocrData);
  } catch (error) {
    console.error('OCR processing error:', error);
    return {
      amount: undefined,
      currency: 'KRW',
      confidence: 0,
      rawText: '',
    };
  }
};

const convertImageToBase64 = async (imageUri: string): Promise<string> => {
  try {
    if (Platform.OS === 'web') {
      // 웹 환경에서의 처리
      const response = await fetch(imageUri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // data:image/jpeg;base64, 부분 제거
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      // React Native 환경에서의 처리
      const { FileSystem } = require('expo-file-system');
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    }
  } catch (error) {
    console.error('Image conversion error:', error);
    throw error;
  }
};

const parseOCRResult = (ocrData: NaverOCRResponse): OCRResult => {
  try {
    const firstImage = ocrData.images[0];
    if (!firstImage?.receipt?.result) {
      return { amount: undefined, currency: 'KRW', confidence: 0 };
    }

    const result = firstImage.receipt.result;
    
    // 총 금액 추출
    const totalPrice = result.totalPrice?.price;
    let amount: number | undefined;
    let confidence = 0;

    if (totalPrice) {
      // formatted 값이 있으면 사용, 없으면 텍스트에서 파싱
      if (totalPrice.formatted?.value) {
        amount = totalPrice.formatted.value;
        confidence = 0.9;
      } else if (totalPrice.text) {
        amount = parseAmountFromText(totalPrice.text);
        confidence = 0.7;
      }
    }

    // 총 금액이 없으면 개별 항목들의 합계 계산
    if (!amount && result.subResults) {
      let total = 0;
      let itemCount = 0;
      
      result.subResults.forEach(subResult => {
        subResult.items?.forEach(item => {
          if (item.price?.formatted?.value) {
            total += item.price.formatted.value;
            itemCount++;
          } else if (item.price?.text) {
            const parsedPrice = parseAmountFromText(item.price.text);
            if (parsedPrice) {
              total += parsedPrice;
              itemCount++;
            }
          }
        });
      });

      if (itemCount > 0) {
        amount = total;
        confidence = 0.6;
      }
    }

    // 통화 감지 (한국어 영수증이므로 기본값은 KRW)
    let currency = 'KRW';
    
    // 원문에서 다른 통화 기호 찾기
    const rawText = JSON.stringify(result);
    if (rawText.includes('$') || rawText.includes('USD')) {
      currency = 'USD';
    } else if (rawText.includes('¥') && rawText.includes('JPY')) {
      currency = 'JPY';
    } else if (rawText.includes('€') || rawText.includes('EUR')) {
      currency = 'EUR';
    }

    return {
      amount,
      currency,
      confidence,
      rawText: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    console.error('OCR parsing error:', error);
    return { amount: undefined, currency: 'KRW', confidence: 0 };
  }
};

const parseAmountFromText = (text: string): number | undefined => {
  try {
    // 숫자와 콤마만 추출
    const cleanText = text.replace(/[^\d,]/g, '');
    
    // 콤마 제거 후 숫자로 변환
    const numberText = cleanText.replace(/,/g, '');
    
    if (numberText && !isNaN(Number(numberText))) {
      return Number(numberText);
    }
    
    return undefined;
  } catch (error) {
    console.error('Amount parsing error:', error);
    return undefined;
  }
};

// 통화 코드를 심볼로 변환
export const getCurrencySymbol = (currencyCode: string): string => {
  const currencyMap: { [key: string]: string } = {
    'KRW': '₩',
    'USD': '$',
    'EUR': '€',
    'JPY': '¥',
    'GBP': '£',
    'CNY': '¥',
    'AUD': 'A$',
    'CAD': 'C$',
    'SGD': 'S$',
    'HKD': 'HK$',
  };
  
  return currencyMap[currencyCode] || currencyCode;
};

// Mock OCR for development/testing
export const mockOCRExtraction = async (imageUri: string): Promise<OCRResult> => {
  // 개발용 Mock 데이터
  await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 지연 시뮬레이션
  
  return {
    amount: Math.floor(Math.random() * 50000) + 5000, // 5,000 ~ 55,000 랜덤 금액
    currency: 'KRW',
    confidence: 0.85,
    rawText: 'Mock OCR result for development',
  };
}; 