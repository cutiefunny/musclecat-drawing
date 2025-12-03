export function updateMonthlyBests(drawings) {
  // 1. 월별로 그림 그룹화 (Key: "2023-11")
  const groups = {};
  
  drawings.forEach(img => {
    const date = new Date(img.time);
    const key = `${date.getFullYear()}-${date.getMonth()}`; // 예: 2023-10
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(img);
  });

  // 2. 각 그룹(월)별 1등 선정
  const bestImageNames = new Set();

  for (const key in groups) {
    const group = groups[key];
    
    // 해당 월의 최대 좋아요 수 찾기
    const maxLikes = Math.max(...group.map(img => img.likes));

    // 좋아요가 0개면 왕관 안 줌 (최소 1개 이상이어야 함)
    if (maxLikes > 0) {
      // 공동 1등도 모두 포함
      group.forEach(img => {
        if (img.likes === maxLikes) {
          bestImageNames.add(img.name);
        }
      });
    }
  }

  // 3. 원본 배열에 플래그 표시 (isMonthlyBest)
  return drawings.map(img => ({
    ...img,
    isMonthlyBest: bestImageNames.has(img.name)
  }));
}