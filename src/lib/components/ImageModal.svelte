<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { cooldownSet } from '$lib/stores/gallery';
  import CommentSection from '$lib/components/CommentSection.svelte';
  import CommentToast from '$lib/components/CommentToast.svelte';
  import { db } from '$lib/firebase';
  import { collection, query, where, getDocs } from 'firebase/firestore';

  export let img; 
  export let isAdmin = false; 
  export let interactive = false; // [추가] 댓글 입력 가능 여부 (기본값 false)

  const dispatch = createEventDispatcher();
  
  let isLandscape = false;
  let userComments = [];
  const colors = [
    'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 
    'rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)', 
    'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)'
  ];

  // 1. 뷰어 모드(토스트)인지 판단: 인터랙티브도 아니고 관리자도 아닐 때
  $: isViewerMode = !interactive && !isAdmin;

  // 2. 뷰어 모드일 때만 댓글 데이터 로드 (토스트용)
  $: if (img && isViewerMode) {
    fetchUserComments(img);
  }

  function onImageLoad(e) {
    const { naturalWidth, naturalHeight } = e.target;
    isLandscape = naturalWidth > naturalHeight;
  }

  async function fetchUserComments(image) {
    userComments = []; 
    try {
      const q = query(collection(db, "comments"), where("imageId", "==", image.name));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        docs = docs.slice(0, 8);

        userComments = docs.map(doc => ({
          id: doc.id,
          text: doc.text,
          x: Math.floor(Math.random() * 80) + 10, 
          y: Math.floor(Math.random() * 70) + 10,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotate: Math.floor(Math.random() * 30) - 15
        }));
      }
    } catch (e) {
      console.error("댓글 로드 실패:", e);
    }
  }
</script>

<div class="image-modal-backdrop" on:click={() => dispatch('close')} transition:fade={{ duration: 200 }}>
  <div class="image-modal-content" class:landscape={isLandscape} class:viewer-mode={isViewerMode} on:click|stopPropagation>
    
    <div class="image-section">
      <img src={img.url} alt="Full size drawing" on:load={onImageLoad} />
      
      {#if img.isMonthlyBest}
          <div class="best-title-badge">
            <span class="crown">👑</span>
            <span class="text">이 달의 그림</span>
          </div>
      {/if}

      <div class="modal-header-actions">
        <div class="like-wrapper">
          <span class="like-count">{img.likes}</span>
          <button 
            class="like-btn" 
            class:disabled={$cooldownSet.has(img.name)}
            on:click={() => dispatch('like', img)}
            title="좋아요"
          >
            ♥
          </button>
        </div>
        <button class="modal-close-btn" on:click={() => dispatch('close')}>×</button>
      </div>

      {#if isViewerMode}
        <CommentToast comment={img.adminComment} variant="modal" />
        {#each userComments as comment (comment.id)}
          <CommentToast 
            comment={comment.text} 
            variant="floating" 
            x={comment.x} 
            y={comment.y} 
            color={comment.color}
            rotate={comment.rotate}
          />
        {/each}
      {/if}
    </div>

    {#if !isViewerMode}
      <div class="comment-container">
        <CommentSection {img} {isAdmin} scrollable={true} />
      </div>
    {/if}

  </div>
</div>

<style>
  .image-modal-backdrop {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85); z-index: 200;
    display: flex; justify-content: center; align-items: center;
  }

  .image-modal-content {
    width: 90%; 
    max-width: 500px;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column; 
    max-height: 90vh;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    transition: max-width 0.3s ease;
  }

  .image-modal-content.landscape {
    max-width: 900px;
  }

  /* 뷰어 모드 스타일: 배경 투명, 그림자 제거 */
  .image-modal-content.viewer-mode {
    background: transparent;
    box-shadow: none;
    overflow: visible; 
  }
  
  .image-modal-content.viewer-mode .image-section {
    background: transparent;
    border-radius: 16px; 
    overflow: hidden;
    position: relative;
  }

  @media (max-width: 600px) {
    .image-modal-content.landscape {
      max-width: 90%;
    }
  }

  .image-section {
    width: 100%;
    position: relative;
    background: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0; 
  }

  .image-section img {
    width: 100%; 
    height: auto;
    object-fit: contain;
    /* 뷰어 모드일 땐 이미지를 더 크게, 아니면 댓글창 공간 확보를 위해 작게 */
    max-height: 55vh; 
    display: block;
  }
  
  .image-modal-content.viewer-mode .image-section img {
    max-height: 80vh; /* 뷰어 모드일 때 이미지 확대 */
  }

  .comment-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-top: 1px solid #eee;
    width: 100%;
    min-height: 0; 
    overflow: hidden;
    background: white; 
  }

  .modal-header-actions {
    position: absolute;
    top: 15px; right: 15px;
    display: flex; gap: 10px; z-index: 205; 
  }

  .like-wrapper {
    display: flex; align-items: center; gap: 6px;
    background: rgba(0, 0, 0, 0.6);
    padding: 4px 10px; border-radius: 20px; color: white;
  }
  .like-count { font-size: 14px; font-weight: bold; }
  
  button.like-btn {
    background: transparent !important; border: none; color: #ff4d4d;
    font-size: 20px; cursor: pointer; padding: 0;
    display: flex; align-items: center; transition: transform 0.2s;
  }
  button.like-btn:hover { transform: scale(1.2); }
  button.like-btn.disabled { color: #ccc; cursor: not-allowed; transform: none; }

  .modal-close-btn {
    background: rgba(0, 0, 0, 0.6); color: white; width: 32px; height: 32px;
    border-radius: 50%;
    border: none; font-size: 20px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }

  .best-title-badge {
    position: absolute; top: 15px; left: 15px;
    background: #FFD700; color: #5a3e00;
    padding: 5px 12px;
    border-radius: 20px;
    font-weight: bold; font-size: 0.8rem;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    display: flex; gap: 4px; align-items: center;
    z-index: 205;
  }
</style>