<script>
  import { fade } from 'svelte/transition';
  
  export let comment = '';
  export let variant = 'modal'; // 'modal' | 'screensaver' | 'floating' [수정]
  
  // [추가] 랜덤 배치를 위한 props
  export let x = 50; // left %
  export let y = 50; // top %
  export let color = 'rgba(255, 255, 255, 0.2)';
  export let rotate = 0; // deg
</script>

{#if comment}
  <div 
    class="comment-toast {variant}" 
    transition:fade 
    style:--left="{x}%"
    style:--top="{y}%"
    style:--bg-color="{color}"
    style:--rotate="{rotate}deg"
  >
    {#if variant !== 'floating'}
      <img src="/nya-face.png" alt="Comment Icon" class="comment-icon" />
    {/if}
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
    background: transparent !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    opacity: 1 !important;
    flex-shrink: 0; 
  }

  /* 1. Modal용 스타일 */
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
  .comment-toast.modal .comment-icon {
    width: 48px;
    height: 32px;
  }

  /* 2. Screensaver용 스타일 (하단 고정 관리자 메모) */
  .comment-toast.screensaver {
    bottom: 15%;
    background: rgba(80, 80, 80, 0.2);
    padding: 15px 30px;
    font-size: 1.5rem;
    font-weight: bold;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
    border: 1px solid rgba(80, 80, 80, 0.2);
    z-index: 10001;
    gap: 15px;
  }
  .comment-toast.screensaver .comment-icon {
    width: 54px;
    height: 54px;
  }

  /* [추가] 3. Floating 스타일 (랜덤 위치 사용자 댓글) */
  .comment-toast.floating {
    position: absolute;
    /* CSS 변수로 위치 및 스타일 동적 할당 */
    left: var(--left);
    top: var(--top);
    background: var(--bg-color);
    transform: translate(-50%, -50%) rotate(var(--rotate));
    
    padding: 10px 18px;
    font-size: 1.1rem;
    font-weight: bold;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    z-index: 10000; /* 관리자 메모(10001)보다는 뒤에 */
    max-width: 40%; /* 화면 너무 가리지 않게 */
    animation: float 6s ease-in-out infinite alternate; /* 둥둥 떠다니는 애니메이션 */
  }

  @keyframes float {
    from { margin-top: 0px; }
    to { margin-top: -10px; }
  }
</style>