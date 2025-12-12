<script>
  import { fade } from 'svelte/transition';
  import { isScreensaverOn } from '$lib/stores/drawing';
  import { savedDrawings } from '$lib/stores/gallery';
  import { createEventDispatcher } from 'svelte';
  import CommentToast from '$lib/components/CommentToast.svelte';
  import { db } from '$lib/firebase';
  import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

  export let index = 0;
  const dispatch = createEventDispatcher();
  
  let userComments = [];

  const colors = [
    'rgba(255, 99, 132, 0.4)', 'rgba(54, 162, 235, 0.4)',
    'rgba(255, 206, 86, 0.4)', 'rgba(75, 192, 192, 0.4)',
    'rgba(153, 102, 255, 0.4)', 'rgba(255, 159, 64, 0.4)'
  ];

  // index가 바뀌면(슬라이드가 넘어가면) 댓글 새로 로드
  $: if ($isScreensaverOn && $savedDrawings.length > 0) {
    fetchUserComments($savedDrawings[index]);
  }

  async function fetchUserComments(img) {
    if (!img) return;
    userComments = [];

    try {
      const q = query(
        collection(db, "comments"),
        where("imageId", "==", img.name),
        orderBy("createdAt", "desc"),
        limit(8) 
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        userComments = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text,
            x: Math.floor(Math.random() * 80) + 10,
            y: Math.floor(Math.random() * 70) + 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotate: Math.floor(Math.random() * 20) - 10
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
  .screensaver-slide {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
  }
  .screensaver-slide img {
    width: 100%; height: 100%;
    object-fit: contain;
    opacity: 0.9;
  }
  .screensaver-overlay {
    position: absolute;
    top: 0px;
    width: 100%;
    text-align: center;
    z-index: 10000;
  }
  .screensaver-text {
    font-size: 2.0rem;
    color: white;
    font-weight: bold;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
  }
  .screensaver-crown {
    position: absolute;
    top: 10%; right: 10%;
    font-size: 2rem;
    color: #FFD700;
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