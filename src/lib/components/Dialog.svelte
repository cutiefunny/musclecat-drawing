<script>
  import { dialogStore, closeDialog } from '$lib/stores/dialog';
  import { fade, fly } from 'svelte/transition';

  // 스토어 구독
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
      <div class="content">
        <p class="message">{state.message}</p>
      </div>
      
      <div class="actions">
        {#if state.type === 'confirm'}
          <button class="btn cancel" on:click={handleCancel}>취소</button>
        {/if}
        <button class="btn confirm" on:click={handleConfirm}>확인</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
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
    min-width: 300px;
    max-width: 90%;
    text-align: center;
  }

  .message {
    font-size: 1.1rem;
    color: #333;
    margin: 0 0 25px 0;
    line-height: 1.5;
    white-space: pre-line; /* 줄바꿈 지원 */
  }

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
    transition: transform 0.1s, opacity 0.2s;
  }

  .btn:active {
    transform: scale(0.96);
  }

  .confirm {
    background: #28a745; /* 메인 녹색 */
    color: white;
  }
  .confirm:hover {
    background: #218838;
  }

  .cancel {
    background: #f1f3f5;
    color: #495057;
  }
  .cancel:hover {
    background: #e9ecef;
  }
</style>