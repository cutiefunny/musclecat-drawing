<script>
  import { fade } from 'svelte/transition';
  import { isScreensaverOn } from '$lib/stores/drawing';
  import { savedDrawings } from '$lib/stores/gallery';
  import { createEventDispatcher } from 'svelte';

  export let index = 0; // 부모가 제어하는 슬라이드 인덱스
  const dispatch = createEventDispatcher();
</script>

{#if $isScreensaverOn && $savedDrawings.length > 0}
  <div class="screensaver" transition:fade={{ duration: 500 }} on:click={() => dispatch('stop')}>
    {#key index}
      <div class="screensaver-slide" transition:fade={{ duration: 1500 }}>
        <img src={$savedDrawings[index].url} alt="Screensaver Art" />
      </div>
    {/key}
    <div class="screensaver-overlay">
      <p class="screensaver-text">화면을 터치해서 그림을 그리자!</p>
    </div>
  </div>
{/if}

<style>
  /* Screensaver 관련 CSS */
  .screensaver { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: #000; z-index: 9999; display: flex; justify-content: center; align-items: center; }
  .screensaver-slide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
  .screensaver-slide img { width: 100%; height: 100%; object-fit: contain; opacity: 0.9; }
  .screensaver-overlay { position: absolute; bottom: 50px; width: 100%; text-align: center; z-index: 10000; }
  .screensaver-text { font-size: 1.5rem; color: rgb(0, 0, 0); font-weight: bold; animation: pulse 2s infinite; }
  @keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }
</style>