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
        
        if (amount > 0 && amount < 1000000) { // 합리적인 범위의 금액
          console.log('Valid amount found:', amount);
          amounts.push(amount);
        } else {
          console.log('Amount out of valid range:', amount);
        }
      }
    }
  }

  console.log('All found amounts:', amounts);

  // 가장 큰 금액을 총액으로 간주 (일반적으로 영수증에서 총액이 가장 큰 값)
  if (amounts.length > 0) {
    const maxAmount = Math.max(...amounts);
    const result = maxAmount.toFixed(2);
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

// Clova OCR API 호출
export const processImageWithClovaOCR = async (imageUri: string): Promise<OCRResult> => {
  try {
    console.log('=== OCR Service Started ===');
    console.log('Input imageUri:', imageUri);

    // 이미지를 Base64로 변환
    console.log('Converting image to Base64...');
    const base64Image = await imageToBase64(imageUri);
    console.log('Base64 conversion completed. Length:', base64Image.length);
    
    // 이미지 형식 감지
    const imageFormat = getImageFormat(imageUri);
    console.log('Detected image format:', imageFormat);
    
    // Clova OCR API 요청 데이터
    const requestData = {
      images: [
        {
          format: imageFormat,
          name: 'receipt',
          data: base64Image
        }
      ],
      requestId: `receipt_${Date.now()}`,
      version: 'V2',
      timestamp: Date.now()
    };

    console.log('=== Sending OCR Request ===');
    console.log('Request URL:', CLOVA_OCR_CONFIG.apiUrl);
    console.log('Request data (without image):', {
      ...requestData,
      images: [{ 
        format: requestData.images[0].format,
        name: requestData.images[0].name,
        data: '[BASE64_DATA_HIDDEN]' 
      }]
    });

    const response = await fetch(CLOVA_OCR_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OCR-SECRET': CLOVA_OCR_CONFIG.secretKey,
      },
      body: JSON.stringify(requestData),
    });

    console.log('=== OCR API Response ===');
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OCR API Error Response:', errorText);
      throw new Error(`OCR API 오류: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('=== OCR API Success Response ===');
    console.log('Full API Response:', JSON.stringify(result, null, 2));

    // OCR 결과에서 텍스트 추출
    let extractedText = '';
    if (result.images && result.images[0] && result.images[0].fields) {
      console.log('Extracting text from fields...');
      console.log('Number of fields:', result.images[0].fields.length);
      
      extractedText = result.images[0].fields
        .map((field: any) => {
          console.log('Field:', field);
          return field.inferText;
        })
        .join('\n');
    } else {
      console.log('No fields found in OCR response');
      // fields가 없는 경우 다른 형태의 응답 구조 확인
      if (result.images && result.images[0]) {
        console.log('Checking alternative response structure...');
        const image = result.images[0];
        
        // 다른 가능한 필드들 확인
        if (image.receipt && image.receipt.result && image.receipt.result.storeInfo) {
          console.log('Found receipt structure');
          extractedText = image.receipt.result.storeInfo.name || '';
        }
        
        if (image.inferResult) {
          console.log('Found inferResult');
          extractedText = image.inferResult;
        }
      }
    }

    console.log('=== Extracted Text ===');
    console.log('Raw extracted text:', extractedText);

    // 텍스트에서 가격과 설명 추출
    console.log('Extracting price and description...');
    const amount = extractPriceFromText(extractedText);
    const description = extractDescriptionFromText(extractedText);
    
    console.log('Extracted amount:', amount);
    console.log('Extracted description:', description);

    const ocrResult: OCRResult = {
      amount: amount || undefined,
      description: description || '영수증',
      rawText: extractedText,
      confidence: result.images?.[0]?.fields?.[0]?.inferConfidence || 
                 result.images?.[0]?.receipt?.result?.storeInfo?.confidence || 0
    };

    console.log('=== Final OCR Result ===');
    console.log('Final result:', JSON.stringify(ocrResult, null, 2));
    return ocrResult;

  } catch (error: any) {
    console.error('=== OCR Service Error ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);
    
    // 에러가 발생해도 기본값 반환
    const fallbackResult: OCRResult = {
      amount: undefined,
      description: '영수증',
      rawText: `OCR 처리 중 오류 발생: ${error.message}`,
      confidence: 0
    };
    
    console.log('Returning fallback result:', fallbackResult);
    return fallbackResult;
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