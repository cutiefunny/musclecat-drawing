<script>
  import { dialogStore, closeDialog } from '$lib/stores/dialog';
  import { fade, fly } from 'svelte/transition';

  let state;
  dialogStore.subscribe(value => {
    state = value;
  });

  function handleConfirm() {
    closeDialog(true);
  }

  function handleCancel() {
    closeDialog(false);
  }
</script>

{#if state.isOpen}
  <div class="backdrop" transition:fade={{ duration: 200 }}>
    <div class="dialog-box" transition:fly={{ y: 20, duration: 300 }}>
      
      {#if state.type === 'loading'}
        <div class="loading-content">
          <div class="spinner"></div>
          <p class="message">{state.message}</p>
        </div>
      
      {:else}
        <div class="content">
          <p class="message">{state.message}</p>
        </div>
        
        <div class="actions">
          {#if state.type === 'confirm'}
            <button class="btn cancel" on:click={handleCancel}>취소</button>
          {/if}
          <button class="btn confirm" on:click={handleConfirm}>확인</button>
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }

  .dialog-box {
    background: white;
    padding: 25px;
    border-radius: 16px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    min-width: 280px;
    max-width: 85%;
    text-align: center;
  }

  .message {
    font-size: 1.1rem;
    color: #333;
    margin: 0;
    line-height: 1.5;
    white-space: pre-line;
  }
  
  /* 로딩 관련 스타일 */
  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    padding: 10px 0;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #28a745; /* 녹색 포인트 */
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .content { margin-bottom: 25px; }

  .actions {
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .btn {
    border: none;
    padding: 10px 24px;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.1s;
  }
  .btn:active { transform: scale(0.96); }

  .confirm { background: #28a745; color: white; }
  .confirm:hover { background: #218838; }

  .cancel { background: #f1f3f5; color: #495057; }
  .cancel:hover { background: #e9ecef; }
</style>