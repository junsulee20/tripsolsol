import Constants from 'expo-constants';
import { ExchangeRateResponse } from '../types';

const API_URL = 'https://www.koreaexim.go.kr/site/program/financial/exchangeJSON';

// API 키 가져오기 과정을 자세히 로그로 확인
console.log('🔍 API 키 확인 시작:');
console.log('Constants.expoConfig?.extra?.exchangeApiKey:', Constants.expoConfig?.extra?.exchangeApiKey);
console.log('Constants.manifest?.extra?.exchangeApiKey:', (Constants.manifest as any)?.extra?.exchangeApiKey);
console.log('Constants.manifest2?.extra?.exchangeApiKey:', (Constants.manifest2 as any)?.extra?.exchangeApiKey);

// Expo Constants에서 API 키 가져오기 (타입 안전하게)
const API_KEY = Constants.expoConfig?.extra?.exchangeApiKey || 
  (Constants.manifest as any)?.extra?.exchangeApiKey ||
  (Constants.manifest2 as any)?.extra?.exchangeApiKey ||
  'EKqvkPcQXQukgtH8tVtmPH7AQkSwcBHE'; // 하드코딩된 키를 fallback으로 사용

console.log('✅ 최종 선택된 API_KEY:', API_KEY);
console.log('API_KEY가 .env의 키와 일치하는지:', API_KEY === 'EKqvkPcQXQukgtH8tVtmPH7AQkSwcBHE');

// 오늘 날짜를 YYYYMMDD 형식으로 반환
export const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

// 최근 영업일 날짜를 YYYYMMDD 형식으로 반환 (최대 7일 전까지)
export const getRecentBusinessDay = (): string => {
  const today = new Date();
  
  // 오늘부터 시작해서 7일 전까지 확인
  for (let i = 0; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
  }
  
  return getTodayString(); // fallback
};

// 환율 정보 가져오기
export const getExchangeRates = async (): Promise<ExchangeRateResponse[]> => {
  try {
    console.log('=== 환율 API 호출 시작 ===');
    console.log('API_KEY:', API_KEY ? `Available (length: ${API_KEY.length})` : 'Not available');
    console.log('Constants.expoConfig:', Constants.expoConfig);
    console.log('Constants.manifest:', Constants.manifest);
    
    if (!API_KEY) {
      console.error('❌ API 키가 없습니다!');
      throw new Error('환율 API 키가 설정되지 않았습니다.');
    }

    // 오늘 날짜로 먼저 시도, 실패하면 어제 날짜로 시도
    let searchDate = getTodayString();
    let url = `${API_URL}?authkey=${API_KEY}&searchdate=${searchDate}&data=AP01`;
    
    console.log('📅 검색 날짜 (오늘):', searchDate);
    console.log('🔗 요청 URL:', url.replace(API_KEY, 'HIDDEN_API_KEY'));
    
    let response = await fetch(url);
    console.log('📡 응답 상태 (오늘):', response.status, response.statusText);
    
    // 오늘 데이터가 없으면 어제 시도
    if (!response.ok || response.status !== 200) {
      console.log('⚠️ 오늘 데이터 없음, 어제 날짜로 시도...');
      searchDate = getRecentBusinessDay();
      url = `${API_URL}?authkey=${API_KEY}&searchdate=${searchDate}&data=AP01`;
      
      console.log('📅 검색 날짜 (어제):', searchDate);
      console.log('🔗 요청 URL:', url.replace(API_KEY, 'HIDDEN_API_KEY'));
      
      response = await fetch(url);
      console.log('📡 응답 상태 (어제):', response.status, response.statusText);
    }
    
    if (!response.ok) {
      console.error('❌ HTTP 오류:', response.status, response.statusText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const responseText = await response.text();
    console.log('📝 원시 응답 텍스트 (처음 200자):', responseText.substring(0, 200));
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON 파싱 오류:', parseError);
      console.error('원시 응답:', responseText);
      throw new Error('응답을 JSON으로 파싱할 수 없습니다.');
    }
    
    console.log('📊 파싱된 데이터 타입:', typeof data, Array.isArray(data) ? `배열 (길이: ${data.length})` : '배열 아님');
    
    // 응답이 배열인지 확인
    if (!Array.isArray(data)) {
      console.log('⚠️ 응답이 배열이 아닙니다:', typeof data);
      // API 오류 응답인 경우 메시지 확인
      if (data && typeof data === 'object') {
        console.log('오류 객체:', JSON.stringify(data, null, 2));
        if (data.result) {
          console.log('API result code:', data.result);
        }
        if (data.message) {
          console.log('API error message:', data.message);
        }
      }
      return [];
    }
    
    console.log('✅ 환율 정보 성공적으로 가져옴:', data.length, '개 통화');
    console.log('처음 3개 통화:', data.slice(0, 3).map(item => `${item.cur_unit}: ${item.kftc_deal_bas_r}`));
    return data;
  } catch (error) {
    console.error('❌ 환율 정보 가져오기 실패:', error);
    if (error instanceof Error) {
      console.error('오류 메시지:', error.message);
      console.error('오류 스택:', error.stack);
    }
    return [];
  }
};

// 특정 통화의 환율 가져오기
export const getExchangeRate = async (currency: string): Promise<number> => {
  try {
    const rates = await getExchangeRates();
    
    // 정확한 매칭 먼저 시도
    let rate = rates.find(r => r.cur_unit === currency);
    
    // 정확한 매칭이 없으면 부분 매칭 시도 (예: JPY -> JPY(100))
    if (!rate) {
      rate = rates.find(r => 
        r.cur_unit.includes(currency) || 
        currency.includes(r.cur_unit.replace(/\([^)]*\)/, '').trim())
      );
    }
    
    if (!rate) {
      console.log(`❌ 환율을 찾을 수 없음: ${currency}`);
      console.log('사용 가능한 통화:', rates.map(r => r.cur_unit).join(', '));
      return 1; // 기본값 1 (변환하지 않음)
    }
    
    console.log(`✅ ${currency} 환율 찾음:`, rate.cur_unit, rate.kftc_deal_bas_r);
    
    // 숫자 형태로 변환 (쉼표 제거)
    const numericRate = parseFloat(rate.kftc_deal_bas_r.replace(/,/g, ''));
    
    // JPY(100) 같은 경우 100으로 나누어야 함
    if (rate.cur_unit.includes('(100)')) {
      return isNaN(numericRate) ? 1 : numericRate / 100;
    }
    
    return isNaN(numericRate) ? 1 : numericRate;
  } catch (error) {
    console.error('Error getting exchange rate for currency:', currency, error);
    return 1;
  }
};

// 금액을 KRW로 변환
export const convertToKRW = async (amount: number, fromCurrency: string): Promise<number> => {
  try {
    if (fromCurrency === 'KRW' || fromCurrency === 'KWR') {
      return amount; // 이미 KRW인 경우 변환하지 않음
    }
    
    const exchangeRate = await getExchangeRate(fromCurrency);
    return Math.round(amount * exchangeRate);
  } catch (error) {
    console.error('Error converting to KRW:', error);
    return amount; // 오류 시 원래 금액 반환
  }
};

// 주요 통화 목록 (실제 API 응답에 맞춤)
export const MAJOR_CURRENCIES = [
  'USD', 'EUR', 'JPY(100)', 'CNH', 'GBP', 'AUD', 'CAD', 'CHF', 'HKD', 'SGD', 'THB', 'MYR'
];

// API 연결 테스트 함수
export const testExchangeAPI = async (): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    console.log('🧪 환율 API 연결 테스트 시작');
    
    // 1. API 키 확인
    if (!API_KEY) {
      return {
        success: false,
        message: 'API 키가 설정되지 않았습니다.'
      };
    }
    
    // 2. 기본 API 호출 테스트 (어제 날짜로 시도)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const testDate = `${yesterday.getFullYear()}${String(yesterday.getMonth() + 1).padStart(2, '0')}${String(yesterday.getDate()).padStart(2, '0')}`;
    
    const testUrl = `${API_URL}?authkey=${API_KEY}&searchdate=${testDate}&data=AP01`;
    console.log('🔗 테스트 URL (어제 날짜):', testUrl.replace(API_KEY, 'HIDDEN_API_KEY'));
    
    const response = await fetch(testUrl);
    const responseText = await response.text();
    
    console.log('📡 테스트 응답 상태:', response.status);
    console.log('📝 테스트 응답 내용:', responseText);
    
    if (!response.ok) {
      return {
        success: false,
        message: `HTTP 오류: ${response.status} ${response.statusText}`,
        data: responseText
      };
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        message: 'JSON 파싱 실패',
        data: responseText
      };
    }
    
    if (Array.isArray(data) && data.length > 0) {
      return {
        success: true,
        message: `성공! ${data.length}개 통화 정보 가져옴`,
        data: data.slice(0, 3) // 처음 3개만 반환
      };
    } else {
      return {
        success: false,
        message: '데이터가 배열이 아니거나 비어있음',
        data: data
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `오류: ${error instanceof Error ? error.message : String(error)}`,
      data: error
    };
  }
}; 