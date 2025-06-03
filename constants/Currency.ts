export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: Currency[] = [
  {
    code: 'KRW',
    name: '대한민국 원',
    symbol: '₩'
  },
  {
    code: 'USD',
    name: '미국 달러',
    symbol: '$'
  },
  {
    code: 'EUR',
    name: '유로',
    symbol: '€'
  },
  {
    code: 'JPY',
    name: '일본 엔',
    symbol: '¥'
  },
  {
    code: 'CNY',
    name: '중국 위안',
    symbol: '¥'
  },
  {
    code: 'GBP',
    name: '영국 파운드',
    symbol: '£'
  }
]; 