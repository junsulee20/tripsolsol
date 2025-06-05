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

// 가격 패턴 매칭 (다양한 형태의 가격 인식)
const extractPriceFromText = (text: string): string | null => {
  console.log('=== Price Extraction ===');
  console.log('Input text for price extraction:', text);
  
  // 다양한 가격 패턴 (더욱 포괄적으로)
  const pricePatterns = [
    // 1. 합계/총액/총계 키워드와 함께 나오는 금액
    /(?:합계|총액|총계|금액|결제|지불|payment|total|sum|amount)\s*:?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:원|₩|\$|USD|KRW|won)?/gi,
    
    // 2. 원화 기호와 함께 나오는 금액 (앞에 ₩가 있는 경우)
    /₩\s*([0-9,]+(?:\.[0-9]{1,2})?)/g,
    
    // 3. 달러 기호와 함께 나오는 금액
    /\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/g,
    
    // 4. 숫자 + 원 패턴
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*원/g,
    
    // 5. 큰 금액 패턴 (천 단위 구분자 포함)
    /([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)/g,
    
    // 6. 소수점 포함 금액 (달러/센트 형태)
    /([0-9]+\.[0-9]{2})/g,
    
    // 7. 단순 4자리 이상 숫자 (영수증에서 가격일 가능성이 높음)
    /(?<![0-9])([0-9]{4,})(?![0-9])/g,
    
    // 8. 한국어 키워드 뒤의 숫자
    /(?:가격|값|비용|요금|price)\s*:?\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi
  ];

  const amounts: number[] = [];

  for (let i = 0; i < pricePatterns.length; i++) {
    const pattern = pricePatterns[i];
    console.log(`Testing pattern ${i + 1}:`, pattern);
    
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      console.log('Pattern match found:', match);
      const amountStr = match[1]?.replace(/,/g, '') || match[0]?.replace(/[^0-9.]/g, '');
      console.log('Extracted amount string:', amountStr);
      
      if (amountStr) {
        const amount = parseFloat(amountStr);
        console.log('Parsed amount:', amount);
        
        // 금액 범위 검증 (10원 ~ 1,000,000원)
        if (amount >= 10 && amount <= 1000000) {
          console.log('Valid amount found:', amount);
          amounts.push(amount);
        } else {
          console.log('Amount out of valid range:', amount);
        }
      }
    }
  }

  console.log('All found amounts:', amounts);

  if (amounts.length > 0) {
    // 가장 큰 금액을 총액으로 간주 (일반적으로 영수증에서 총액이 가장 큰 값)
    const maxAmount = Math.max(...amounts);
    
    // 소수점 처리: 100 이상이면 정수로, 미만이면 소수점 2자리로
    const result = maxAmount >= 100 ? maxAmount.toFixed(0) : maxAmount.toFixed(2);
    console.log('Selected max amount:', result);
    return result;
  }

  console.log('No valid amounts found');
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
      throw new Error('웹에서 이미지 변환에 실패했습니다: ' + error.message);
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
      throw new Error('이미지 변환에 실패했습니다: ' + error.message);
    }
  }
};

// 영수증에서 금액 후보 숫자들 추출 (새로 추가)
const extractCandidateNumbers = (text: string): string[] => {
  console.log('=== Candidate Numbers Extraction ===');
  console.log('Input text:', text);
  
  const candidates: string[] = [];
  const seenNumbers = new Set<string>(); // 중복 방지
  
  // 다양한 숫자 패턴
  const numberPatterns = [
    // 1. 쉼표가 포함된 숫자 (1,000, 10,000 등)
    /([0-9]{1,3}(?:,[0-9]{3})+)/g,
    
    // 2. 소수점 포함 숫자 (달러/센트 형태)
    /([0-9]+\.[0-9]{1,2})/g,
    
    // 3. 일반 정수 (4자리 이상)
    /(?<![0-9])([0-9]{4,9})(?![0-9])/g,
    
    // 4. 원화 표시와 함께 나오는 숫자
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*원/g,
    
    // 5. 통화 기호와 함께 나오는 숫자
    /[₩$]\s*([0-9,]+(?:\.[0-9]{1,2})?)/g
  ];

  for (const pattern of numberPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      let numberStr = match[1] || match[0];
      
      // 쉼표 제거
      const cleanNumber = numberStr.replace(/,/g, '');
      const numValue = parseFloat(cleanNumber);
      
      // 필터링 조건:
      // 1. 10자리 이상 제외 (전화번호, 주문번호 등 제외)
      // 2. 금액 범위: 10 ~ 10,000,000 사이
      // 3. 유효한 숫자인지 확인
      if (!isNaN(numValue) && 
          cleanNumber.length < 10 && 
          numValue >= 10 && 
          numValue <= 10000000) {
        
        // 원래 형태 유지 (쉼표 포함된 형태 선호)
        const displayNumber = numValue >= 1000 ? 
          numValue.toLocaleString() : 
          cleanNumber;
        
        if (!seenNumbers.has(displayNumber)) {
          seenNumbers.add(displayNumber);
          candidates.push(displayNumber);
        }
      }
    }
  }
  
  // 숫자 크기순으로 정렬 (큰 금액부터)
  candidates.sort((a, b) => {
    const numA = parseFloat(a.replace(/,/g, ''));
    const numB = parseFloat(b.replace(/,/g, ''));
    return numB - numA;
  });
  
  console.log('Filtered candidate numbers:', candidates);
  return candidates.slice(0, 10); // 최대 10개까지만 반환
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
          candidateNumbers: ['15,000', '12,000', '5,500', '1,750', '2024', '1234']
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
    const finalAmount = templateAmount || extractPriceFromText(extractedText) || '';
    const finalDescription = templateStoreName || extractDescriptionFromText(extractedText) || '';
    
    const ocrResult: OCRResult = {
      amount: finalAmount,
      description: finalDescription,
      rawText: extractedText,
      confidence: extractedText ? 0.8 : 0.1, // 텍스트가 있으면 기본 신뢰도 0.8
      candidateNumbers: extractCandidateNumbers(extractedText),
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