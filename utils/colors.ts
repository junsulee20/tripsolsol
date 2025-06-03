const AVATAR_COLORS = [
  '#4A90E2', // Blue
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#FFD93D', // Yellow
  '#95A5A6', // Gray
  '#2ECC71', // Green
  '#E74C3C', // Dark Red
  '#9B59B6', // Purple
  '#1ABC9C', // Turquoise
  '#F39C12', // Orange
];

export const getAvatarColor = (id: string): string => {
  if (!id) return AVATAR_COLORS[0];
  
  // 문자열의 각 문자 코드를 합산하여 색상 인덱스 결정
  const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}; 