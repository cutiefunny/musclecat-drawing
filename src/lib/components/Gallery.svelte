<script>
  import { onMount, onDestroy } from 'svelte';
  import emblaCarouselSvelte from 'embla-carousel-svelte';
  import { createEventDispatcher } from 'svelte';
  import { savedDrawings } from '$lib/stores/gallery';
  import { showConfirm, showAlert } from '$lib/stores/dialog';
  
  // Firebase 관련 임포트
  import { db, storage } from '$lib/firebase';
  import { collection, query, orderBy, limit, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
  import { ref, deleteObject } from 'firebase/storage';

  const dispatch = createEventDispatcher();
  let emblaApi;
  let unsubscribe;
  let now = Date.now();
  
  const emblaOptions = { loop: false, dragFree: true, containScroll: 'trimSnaps' };

  onMount(() => {
    // 1. 1분마다 '현재 시간' 업데이트 (15분 경과 체크용)
    const timer = setInterval(() => {
      now = Date.now();
    }, 60000);

    // 2. Firestore 실시간 구독
    const q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
      const newItems = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // [수정] 파일명에서 원본 타임스탬프 추출 ("17338...avif" -> 17338...)
        // Firestore 문서 생성일(createdAt) 대신 파일명 시간을 우선 사용
        const filenameTime = parseInt(data.name.split('.')[0]);
        const originalTime = !isNaN(filenameTime) ? filenameTime : (data.createdAt?.toMillis() || 0);

        return {
          id: doc.id,
          ...data,
          ref: ref(storage, data.storageRef),
          time: originalTime
        };
      });
      
      $savedDrawings = newItems;
    });

    return () => {
      clearInterval(timer);
      if (unsubscribe) unsubscribe();
    };
  });

  function onInit(event) {
    emblaApi = event.detail;
  }

  // 삭제 핸들러
  async function handleDelete(img) {
    if (!(await showConfirm('정말 삭제하시겠습니까?'))) return;

    try {
      await deleteObject(img.ref);
      await deleteDoc(doc(db, "posts", img.id));
      await showAlert("삭제되었습니다.");
    } catch (error) {
      console.error("삭제 실패:", error);
      await showAlert("삭제에 실패했습니다.");
    }
  }
</script>

<div class="gallery-wrapper">
  <div class="embla" use:emblaCarouselSvelte={{ options: emblaOptions, plugins: [] }} on:emblaInit={onInit}>
    <div class="embla__container">
      {#each $savedDrawings as img (img.id)}
        <div class="embla__slide">
          <div class="image-card" on:click={() => dispatch('open', img)}>
            <img src={img.url} alt="Saved drawing" loading="lazy" />

            {#if img.isMonthlyBest}
                 <div class="crown-badge" title="이 달의 그림">👑</div>
            {/if}
            
            {#if (now - img.time) < 15 * 60 * 1000}
              <button 
                class="delete-img-btn" 
                on:click|stopPropagation={() => handleDelete(img)}
                title="삭제하기"
              >
                ×
              </button>
             {/if}
          </div>
        </div>
      {/each}

      {#if $savedDrawings.length === 0}
          <div class="empty-message">아직 그림이 없어요 🎨</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .gallery-wrapper {
    position: absolute; bottom: 20px; left: 0; width: 100%; height: 120px;
    z-index: 10;
    background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(5px);
    border-top: 1px solid #eee; padding: 10px 0; box-sizing: border-box;
  }
  .embla { overflow: hidden; width: 100%; height: 100%; }
  .embla__container { display: flex; padding-left: 20px; gap: 10px; }
  .embla__slide { flex: 0 0 auto; width: 100px; height: 100px; }
  
  .image-card {
    position: relative; width: 100%; height: 100%; background: white;
    border-radius: 12px;
    overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 2px solid #eee; display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .image-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
  
  .empty-message { 
    display: flex; align-items: center; padding-left: 20px; 
    color: #888; font-size: 0.9rem; white-space: nowrap;
  }

  .delete-img-btn {
    position: absolute; top: 5px; right: 5px; width: 24px;
    height: 24px;
    background: rgba(255, 68, 68, 0.9); color: white; border-radius: 50%;
    border: none; font-size: 16px; line-height: 1; cursor: pointer;
    display: flex; align-items: center; justify-content: center; padding: 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  .delete-img-btn:hover { background: #cc0000; transform: scale(1.1); }

  .crown-badge {
    position: absolute;
    top: 5px; left: 5px;
    font-size: 20px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    width: 30px; height: 30px;
    display: flex;
    justify-content: center; align-items: center;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 5;
    animation: bounce 2s infinite;
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
</style>