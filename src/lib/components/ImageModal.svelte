<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { cooldownSet } from '$lib/stores/gallery';
  import CommentSection from '$lib/components/CommentSection.svelte';

  export let img; 
  const dispatch = createEventDispatcher();

  // [추가] 이미지 비율 감지 상태
  let isLandscape = false;

  function onImageLoad(e) {
    const { naturalWidth, naturalHeight } = e.target;
    // 가로가 세로보다 길면 landscape 모드 활성화
    isLandscape = naturalWidth > naturalHeight;
  }
</script>

<div class="image-modal-backdrop" on:click={() => dispatch('close')} transition:fade={{ duration: 200 }}>
  <div class="image-modal-content" class:landscape={isLandscape} on:click|stopPropagation>
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
    </div>

    <div class="comment-container">
      <CommentSection {img} scrollable={true} />
    </div>
  </div>
</div>

<style>
  .image-modal-backdrop {
    position: fixed; top: 0;
    left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85); z-index: 200;
    display: flex;
    justify-content: center; align-items: center;
  }

  .image-modal-content {
    width: 90%; 
    max-width: 500px; /* 기본값 (세로형/정사각형) */
    background: white;
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column; 
    max-height: 90vh; 
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    transition: max-width 0.3s ease; /* 너비 변경 시 부드럽게 전환 */
  }

  /* [추가] 가로형 이미지일 때 최대 너비 확장 */
  .image-modal-content.landscape {
    max-width: 900px; 
  }

  /* 모바일 화면에서는 비율 상관없이 꽉 차게 유지 */
  @media (max-width: 600px) {
    .image-modal-content.landscape {
      max-width: 90%;
    }
  }

  /* 이미지 섹션 */
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
    max-height: 55vh; 
    display: block;
  }

  /* 댓글 컨테이너 */
  .comment-container {
    flex: 1; 
    display: flex;
    flex-direction: column;
    border-top: 1px solid #eee;
    width: 100%;
    min-height: 0; 
    overflow: hidden; 
  }

  .modal-header-actions {
    position: absolute;
    top: 15px; right: 15px;
    display: flex; gap: 10px; z-index: 10;
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
    border-radius: 50%; border: none; font-size: 20px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }

  .best-title-badge {
    position: absolute; top: 15px; left: 15px;
    background: #FFD700; color: #5a3e00;
    padding: 5px 12px; border-radius: 20px;
    font-weight: bold; font-size: 0.8rem;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    display: flex; gap: 4px; align-items: center;
  }
</style>