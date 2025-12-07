<script>
  import { fade } from 'svelte/transition';
  
  export let comment = '';
  export let variant = 'modal'; // 'modal' | 'screensaver'
</script>

{#if comment}
  <div class="comment-toast {variant}" transition:fade>
    <img src="/nya-face.png" alt="Comment Icon" class="comment-icon" />
    <span class="comment-text">{comment}</span>
  </div>
{/if}

<style>
  /* 공통 스타일 */
  .comment-toast {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    text-align: center;
    border-radius: 30px;
    white-space: pre-wrap;
    backdrop-filter: blur(4px);
    max-width: 80%;
  }

  .comment-icon {
    object-fit: contain;
    /* 부모 컴포넌트(슬라이더 등) 스타일 상속 방지 */
    background: transparent !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    opacity: 1 !important;
    flex-shrink: 0; /* 텍스트가 길어져도 아이콘 크기 유지 */
  }

  /* 1. Modal용 스타일 (진한 배경) */
  .comment-toast.modal {
    bottom: 30px;
    background: rgba(0, 0, 0, 0.7);
    padding: 10px 20px;
    font-size: 1rem;
    font-weight: 500;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    z-index: 202;
    gap: 10px;
  }
  /* [수정] 아이콘 크기 증가 (24px -> 32px) */
  .comment-toast.modal .comment-icon {
    width: 48px;
    height: 32px;
  }

  /* 2. Screensaver용 스타일 (밝은 반투명 배경) */
  .comment-toast.screensaver {
    bottom: 15%;
    background: rgba(255, 255, 255, 0.2);
    padding: 15px 30px;
    font-size: 1.5rem;
    font-weight: bold;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
    border: 1px solid rgba(255, 255, 255, 0.3);
    z-index: 10001;
    gap: 15px;
  }
  /* [수정] 아이콘 크기 증가 (40px -> 54px) */
  .comment-toast.screensaver .comment-icon {
    width: 54px;
    height: 54px;
  }
</style>