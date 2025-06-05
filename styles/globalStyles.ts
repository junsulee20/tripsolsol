import { StyleSheet } from 'react-native';

// 폰트 패밀리 상수
export const fonts = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semiBold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
};

// Pretendard 전역 스타일
export const globalStyles = StyleSheet.create({
  text: {
    fontFamily: fonts.regular,
  },
  textMedium: {
    fontFamily: fonts.medium,
  },
  textSemiBold: {
    fontFamily: fonts.semiBold,
  },
  textBold: {
    fontFamily: fonts.bold,
  },
}); 