<script>
  import { onMount } from 'svelte';
  import emblaCarouselSvelte from 'embla-carousel-svelte';
  import { createEventDispatcher } from 'svelte';
  import { savedDrawings, isGalleryLoading, isGalleryEnd } from '$lib/stores/gallery';

  const dispatch = createEventDispatcher();
  let emblaApi;
  let observerSentinel;
  let now = Date.now();

  const emblaOptions = { loop: false, dragFree: true, containScroll: 'trimSnaps' };

  onMount(() => {
    // 1분마다 now 업데이트 (15분 경과 여부 체크용)
    const timer = setInterval(() => {
      now = Date.now();
    }, 60000);

    // 무한 스크롤 옵저버
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !$isGalleryLoading && !$isGalleryEnd) {
        dispatch('loadMore'); // 부모에게 데이터 요청
      }
    }, { rootMargin: '200px' });

    if (observerSentinel) observer.observe(observerSentinel);

    return () => {
      clearInterval(timer);
      observer.disconnect();
    };
  });

  function onInit(event) {
    emblaApi = event.detail;
  }
</script>

<div class="gallery-wrapper">
  <div class="embla" use:emblaCarouselSvelte={{ options: emblaOptions, plugins: [] }} on:emblaInit={onInit}>
    <div class="embla__container">
      {#each $savedDrawings as img (img.name)}
        <div class="embla__slide">
          <div class="image-card" on:click={() => dispatch('open', img)}>
            <img src={img.url} alt="Saved drawing" loading="lazy" />
            
            {#if (now - img.time) < 15 * 60 * 1000}
              <button 
                class="delete-img-btn" 
                on:click|stopPropagation={() => dispatch('delete', img)}
                title="삭제하기"
              >
                ×
              </button>
             {/if}
          </div>
        </div>
      {/each}
      
      {#if !$isGalleryEnd}
        <div class="embla__slide observer-slide" bind:this={observerSentinel}>
          <div class="loading-placeholder">
            <div class="spinner small"></div>
          </div>
        </div>
      {/if}

      {#if $savedDrawings.length === 0 && $isGalleryEnd}
          <div class="empty-message">저장된 그림이 없습니다.</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .spinner { animation: rotate 1s linear infinite; }
  .spinner.small { width: 24px; height: 24px; border: 3px solid #ddd; border-top-color: #333; border-radius: 50%; }
  @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .gallery-wrapper {
    position: absolute; bottom: 20px; left: 0; width: 100%; height: 120px;
    z-index: 10; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(5px);
    border-top: 1px solid #eee; padding: 10px 0; box-sizing: border-box;
  }
  .embla { overflow: hidden; width: 100%; height: 100%; }
  .embla__container { display: flex; padding-left: 20px; gap: 10px; }
  .embla__slide { flex: 0 0 auto; width: 100px; height: 100px; }
  
  .image-card {
    position: relative; width: 100%; height: 100%; background: white;
    border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 2px solid #eee; display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .image-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .empty-message { padding: 20px; color: #888; font-size: 0.9rem; }

  .delete-img-btn {
    position: absolute; top: 5px; right: 5px; width: 24px; height: 24px;
    background: rgba(255, 68, 68, 0.9); color: white; border-radius: 50%;
    border: none; font-size: 16px; line-height: 1; cursor: pointer;
    display: flex; align-items: center; justify-content: center; padding: 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  .delete-img-btn:hover { background: #cc0000; transform: scale(1.1); }

  .observer-slide { display: flex; align-items: center; justify-content: center; }
  .loading-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f5f5f5; border-radius: 12px; }
</style>