import React, { useEffect } from 'react';
import { router } from 'expo-router';

export default function ExpenseTabScreen() {
  useEffect(() => {
    // 탭이 로드되면 즉시 expense/detail 페이지로 리다이렉트
    router.replace('/expense/detail');
  }, []);

  return null; // 리다이렉트되므로 렌더링할 내용 없음
} 