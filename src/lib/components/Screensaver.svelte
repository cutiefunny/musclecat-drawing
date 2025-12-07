<script>
  import { fade } from 'svelte/transition';
  import { isScreensaverOn } from '$lib/stores/drawing';
  import { savedDrawings } from '$lib/stores/gallery';
  import { createEventDispatcher } from 'svelte';
  import CommentToast from '$lib/components/CommentToast.svelte'; // [추가]

  export let index = 0;
  const dispatch = createEventDispatcher();
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
    top: 10%; right: 10%;
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