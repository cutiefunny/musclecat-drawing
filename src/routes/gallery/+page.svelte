<script>
  import { onMount } from 'svelte';
  import { db } from '$lib/firebase';
  import { collection, query, orderBy, limit, startAfter, getDocs, updateDoc, doc, increment, getDoc } from 'firebase/firestore';
  import { savedDrawings, isGalleryLoading, isGalleryEnd, cooldownSet } from '$lib/stores/gallery';
  import { showAlert } from '$lib/stores/dialog';
  import { updateMonthlyBests } from '$lib/utils/ranking';
  import ImageModal from '$lib/components/ImageModal.svelte';
  import CommentSection from '$lib/components/CommentSection.svelte';

  // 페이지네이션
  const PAGE_SIZE = 15;
  let lastVisibleDoc = null; // Firestore 페이지네이션용 커서
  let observerSentinel;
  
  // UI 상태
  let selectedImage = null; // 모달용 (PC)
  let expandedImageName = null; // 아코디언용 (Mobile)
  let isMobile = false;

  onMount(() => {
    // 초기화
    $savedDrawings = [];
    $isGalleryEnd = false;
    lastVisibleDoc = null;

    loadMoreImages();
    updateCooldowns();
    checkMobile(); 

    window.addEventListener('resize', checkMobile);

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !$isGalleryLoading && !$isGalleryEnd) {
        loadMoreImages();
      }
    }, { rootMargin: '200px' });

    if (observerSentinel) observer.observe(observerSentinel);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', checkMobile);
    };
  });

  function checkMobile() {
    isMobile = window.innerWidth <= 600;
  }

  function handleCardClick(img) {
    if (isMobile) {
      expandedImageName = expandedImageName === img.name ? null : img.name;
    } else {
      selectedImage = img;
    }
  }

  function updateCooldowns() {
    if (typeof localStorage === 'undefined') return;
    const newSet = new Set();
    if ($savedDrawings.length > 0) {
        $savedDrawings.forEach(img => {
            const cd = localStorage.getItem(`like_cooldown_${img.name}`);
            if (cd && Date.now() < parseInt(cd)) newSet.add(img.name);
        });
        $cooldownSet = newSet;
    }
  }

  // [핵심 수정] Firestore에서 데이터 로드
  async function loadMoreImages() {
    if ($isGalleryEnd || $isGalleryLoading) return;

    try {
      $isGalleryLoading = true;
      
      let q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
      );

      if (lastVisibleDoc) {
        q = query(
          collection(db, "posts"),
          orderBy("createdAt", "desc"),
          startAfter(lastVisibleDoc),
          limit(PAGE_SIZE)
        );
      }

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        $isGalleryEnd = true;
        $isGalleryLoading = false;
        return;
      }

      lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

      const newItems = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id, // Firestore 문서 ID
          ...data,
          time: data.createdAt?.toMillis() || 0 // 타임스탬프 변환
        };
      });

      const combined = [...$savedDrawings, ...newItems];
      $savedDrawings = updateMonthlyBests(combined);
      
      updateCooldowns();
    } catch (error) {
      console.error("갤러리 로드 실패:", error);
      await showAlert("갤러리를 불러오는데 실패했어요.");
    } finally {
      $isGalleryLoading = false;
    }
  }

  // [수정] Firestore 좋아요 업데이트
  async function handleLike(arg) {
    const img = arg.detail || arg;

    if ($cooldownSet.has(img.name)) return;
    
    // 1. UI 낙관적 업데이트
    img.likes++;
    $savedDrawings = updateMonthlyBests($savedDrawings);

    // 2. 쿨타임 설정
    const cooldownTime = Date.now() + 60 * 1000;
    localStorage.setItem(`like_cooldown_${img.name}`, cooldownTime.toString());
    $cooldownSet.add(img.name);
    $cooldownSet = new Set($cooldownSet);

    // 3. Firestore 업데이트 (Storage Metadata 아님)
    try {
      // 이미지 name으로 Firestore 문서를 찾거나, id가 있으면 id 사용
      // 여기서는 목록 로드 시 id를 가져왔으므로 img.id 사용 가능
      const docRef = doc(db, "posts", img.id);
      await updateDoc(docRef, {
        likes: increment(1)
      });
    } catch (error) {
      console.error("좋아요 저장 실패:", error);
      img.likes--;
      $savedDrawings = updateMonthlyBests($savedDrawings);
      await showAlert("좋아요 반영에 실패했어요.");
    }
  }
</script>

<div class="page-container">
  <header>
    <h1>근육고양이 갤러리 🐾</h1>
  </header>

  <div class="grid">
    {#each $savedDrawings as img (img.id)}
      <div class="card" class:expanded={expandedImageName === img.name} on:click={() => handleCardClick(img)}>
        
        <div class="image-wrapper">
          <img src={img.url} alt="User drawing" loading="lazy" />
          
          {#if img.isMonthlyBest}
            <div class="crown">👑</div>
          {/if}

          <div class="info">
            <button 
              class="like-btn" 
              class:liked={$cooldownSet.has(img.name)}
              on:click|stopPropagation={() => handleLike(img)}
            >
              ♥ {img.likes}
            </button>

            {#if img.adminComment}
              <span class="comment-badge">💬</span>
            {/if}
          </div>
        </div>

        {#if isMobile && expandedImageName === img.name}
          <div class="inline-comments" on:click|stopPropagation>
            <CommentSection {img} scrollable={false} />
          </div>
        {/if}

      </div>
    {/each}
  </div>

  {#if !$isGalleryEnd}
    <div class="loading-trigger" bind:this={observerSentinel}>
      <div class="spinner"></div>
    </div>
  {/if}

  {#if $savedDrawings.length === 0 && $isGalleryEnd}
    <div class="empty">아직 그려진 그림이 없어요.</div>
  {/if}
</div>

{#if selectedImage}
  <ImageModal 
    img={selectedImage} 
    on:close={() => selectedImage = null}
    on:like={handleLike}
  />
{/if}

<style>
  .page-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background: #fafafa;
    min-height: 100vh;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    margin-bottom: 30px;
    padding-top: 10px;
  }

  h1 { font-size: 1.5rem; color: #333; margin: 0; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 15px;
    align-items: start;
  }

  @media (max-width: 600px) {
    .grid { grid-template-columns: 1fr; }
  }

  .card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    cursor: pointer;
    transition: box-shadow 0.2s, transform 0.2s;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .card:hover {
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.12);
  }

  .image-wrapper {
    width: 100%;
    aspect-ratio: 1; 
    position: relative;
  }

  .image-wrapper img {
    width: 100%; height: 100%; object-fit: cover; display: block;
  }

  .crown {
    position: absolute; top: 5px; left: 5px; font-size: 1.2rem;
    text-shadow: 0 2px 2px rgba(0,0,0,0.2);
  }

  .info {
    position: absolute; bottom: 0; left: 0; right: 0;
    background: linear-gradient(transparent, rgba(0,0,0,0.7));
    padding: 10px; display: flex; justify-content: space-between;
    align-items: center; color: white;
  }

  .like-btn {
    background: transparent; border: none; color: white; font-weight: bold;
    font-size: 0.9rem; cursor: pointer; padding: 4px 8px; border-radius: 12px;
    transition: transform 0.1s, background-color 0.2s;
    display: flex; align-items: center; gap: 4px;
  }
  .like-btn:active { transform: scale(0.9); }
  .like-btn.liked { color: #ffcccc; cursor: default; }

  .comment-badge { font-size: 1rem; }

  .inline-comments {
    border-top: 1px solid #eee; background: #fff; animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .loading-trigger {
    padding: 40px; display: flex; justify-content: center;
  }

  .spinner {
    width: 30px; height: 30px; border: 3px solid #ddd;
    border-top-color: #333; border-radius: 50%; animation: spin 1s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .empty { text-align: center; padding: 50px; color: #888; }
</style>