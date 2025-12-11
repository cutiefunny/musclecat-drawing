<script>
  import { fade } from 'svelte/transition';
  import { isScreensaverOn } from '$lib/stores/drawing';
  import { savedDrawings } from '$lib/stores/gallery';
  import { createEventDispatcher } from 'svelte';
  import CommentToast from '$lib/components/CommentToast.svelte';
  
  // [추가] Firebase 관련 임포트
  import { db } from '$lib/firebase';
  import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

  export let index = 0;
  const dispatch = createEventDispatcher();

  // [추가] 현재 표시 중인 사용자 댓글들
  let userComments = [];

  // 랜덤 색상 팔레트 (반투명 파스텔톤)
  const colors = [
    'rgba(255, 99, 132, 0.4)', // Pink
    'rgba(54, 162, 235, 0.4)', // Blue
    'rgba(255, 206, 86, 0.4)', // Yellow
    'rgba(75, 192, 192, 0.4)', // Green
    'rgba(153, 102, 255, 0.4)', // Purple
    'rgba(255, 159, 64, 0.4)'   // Orange
  ];

  // index가 바뀌면(슬라이드가 넘어가면) 댓글 새로 로드
  $: if ($isScreensaverOn && $savedDrawings.length > 0) {
    fetchUserComments($savedDrawings[index]);
  }

  async function fetchUserComments(img) {
    if (!img) return;
    userComments = []; // 초기화

    try {
      // 해당 이미지의 댓글 중 최근 10개만 가져오기 (화면 복잡도 방지)
      const q = query(
        collection(db, "comments"),
        where("imageId", "==", img.name),
        orderBy("createdAt", "desc"), // 최신순
        limit(8) 
      );

      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // 가져온 댓글들에 랜덤 위치/색상 부여
        userComments = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text,
            // 화면 중앙(왕관, 관리자메모)을 피해 가장자리 위주로 배치하거나 전체 영역 사용
            x: Math.floor(Math.random() * 80) + 10, // 10% ~ 90%
            y: Math.floor(Math.random() * 70) + 10, // 10% ~ 80% (하단 20%는 관리자 메모 영역)
            color: colors[Math.floor(Math.random() * colors.length)],
            rotate: Math.floor(Math.random() * 20) - 10 // -10도 ~ 10도 회전
          };
        });
      }
    } catch (e) {
      console.error("스크린세이버 댓글 로드 실패:", e);
    }
  }
</script>

{#if $isScreensaverOn && $savedDrawings.length > 0}
  <div class="screensaver" transition:fade={{ duration: 500 }} on:click={() => dispatch('stop')}>
    
    {#key index}
      <div class="screensaver-slide" transition:fade={{ duration: 1500 }}>
        <img src={$savedDrawings[index].url} alt="Screensaver Art" />

        {#if $savedDrawings[index].isMonthlyBest}
            <div class="screensaver-crown">
              👑 이 달의 그림
            </div>
        {/if}

        <CommentToast comment={$savedDrawings[index].adminComment} variant="screensaver" />

        {#each userComments as comment}
          <CommentToast 
            comment={comment.text} 
            variant="floating" 
            x={comment.x} 
            y={comment.y} 
            color={comment.color}
            rotate={comment.rotate}
          />
        {/each}

      </div>
    {/key}

    <div class="screensaver-overlay">
      <p class="screensaver-text">화면을 터치해서 그림을 그리자!</p>
    </div>
  </div>
{/if}

<style>
  /* Screensaver 전체 컨테이너 */
  .screensaver {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background-color: #000;
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* 슬라이드 이미지 */
  .screensaver-slide {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
  }
  .screensaver-slide img {
    width: 100%; height: 100%;
    object-fit: contain;
    opacity: 0.9;
  }

  /* 하단 안내 텍스트 */
  .screensaver-overlay {
    position: absolute;
    bottom: 50px;
    width: 100%;
    text-align: center;
    z-index: 10000;
  }
  .screensaver-text {
    font-size: 1.5rem;
    color: white;
    font-weight: bold;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0% { opacity: 0.7; }
    50% { opacity: 1; }
    100% { opacity: 0.7; }
  }

  /* 왕관 배지 스타일 */
  .screensaver-crown {
    position: absolute;
    top: 10%;
    right: 10%;
    font-size: 2rem;
    color: #FFD700; /* 골드 */
    font-weight: bold;
    text-shadow: 0 2px 10px rgba(0,0,0,0.8);
    background: rgba(0, 0, 0, 0.5);
    padding: 10px 20px;
    border-radius: 50px;
    border: 2px solid #FFD700;
    z-index: 10001;
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>