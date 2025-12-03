<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { cooldownSet } from '$lib/stores/gallery';

  export let img; // 부모로부터 선택된 이미지 객체를 받음
  const dispatch = createEventDispatcher();
</script>

<div class="image-modal-backdrop" on:click={() => dispatch('close')} transition:fade={{ duration: 200 }}>
  <div class="image-modal-content" on:click|stopPropagation>
    <img src={img.url} alt="Full size drawing" />
    
    <div class="modal-header">
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
</div>

<style>
  .image-modal-backdrop {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.8); z-index: 200;
    display: flex; justify-content: center; align-items: center;
  }
  .image-modal-content {
    position: relative; width: auto; max-width: 90%; max-height: 90vh;
    padding: 10px; box-sizing: border-box;
  }
  .image-modal-content img {
    width: 100%; height: auto; max-height: 90vh; object-fit: contain;
    display: block; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    background: white;
  }
  .modal-header {
    position: absolute; top: 20px; right: 20px;
    display: flex; align-items: center; gap: 12px; z-index: 201;
  }
  .like-wrapper {
    display: flex; align-items: center; gap: 6px;
    background: rgba(0, 0, 0, 0.6); padding: 4px 10px; border-radius: 20px; color: white;
  }
  .like-count { font-size: 14px; font-weight: bold; }
  button.like-btn {
    background: transparent !important; border: none; color: #ff4d4d;
    font-size: 20px; cursor: pointer; padding: 0; width: auto; height: auto;
    display: flex; align-items: center; transition: transform 0.2s, color 0.2s;
  }
  button.like-btn:hover { background: transparent !important; transform: scale(1.2); }
  button.like-btn.disabled { color: #ccc; cursor: not-allowed; transform: none; }
  .modal-close-btn {
    background: rgba(0, 0, 0, 0.6); color: white; width: 36px; height: 36px;
    border-radius: 50%; border: none; font-size: 24px; line-height: 1;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .modal-close-btn:hover { background: rgba(0, 0, 0, 0.8); }
</style>