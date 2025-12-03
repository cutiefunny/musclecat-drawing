<script>
  import { createEventDispatcher } from 'svelte';
  import { currentTool, color, lastColor, size, isPenMode, isColorPickerOpen, showBrushPreview } from '$lib/stores/drawing';

  export let canUndo = false;
  export let canRedo = false;
  export let isSaving = false;

  const dispatch = createEventDispatcher();

  function setTool(tool) {
    $currentTool = tool;
    $color = (tool === 'eraser') ? '#ffffff' : $lastColor;
  }
</script>

<div class="toolbar">
  <div class="group">
    <button on:click={() => $isPenMode = !$isPenMode} class:active={$isPenMode} title={$isPenMode ? "펜 전용 모드" : "터치 모드"}>
      {$isPenMode ? '🖊️' : '👆'}
    </button>

    <button class="color-btn" style="background-color: {$lastColor};" on:click={() => $isColorPickerOpen = !$isColorPickerOpen}></button>
    
    <button on:click={() => setTool('pen')} class:active={$currentTool === 'pen'}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
    <button on:click={() => setTool('eraser')} class:active={$currentTool === 'eraser'}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg></button>
    <button on:click={() => setTool('bucket')} class:active={$currentTool === 'bucket'}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg></button>

    <input type="range" min="1" max="100" bind:value={$size} 
      on:touchstart={() => $showBrushPreview = true} 
      on:touchend={() => $showBrushPreview = false} 
      on:mousedown={() => $showBrushPreview = true}
      on:mouseup={() => $showBrushPreview = false}
    />
  </div>
  
  <div class="group">
    <button on:click={() => dispatch('undo')} disabled={!canUndo}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>
    <button on:click={() => dispatch('redo')} disabled={!canRedo}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg></button>
    <button on:click={() => dispatch('save')} disabled={isSaving || !canUndo} class="save-btn">
      {#if isSaving} ⏳ {:else} 💾 {/if}
    </button>
  </div>
</div>

<style>
  /* Toolbar 관련 CSS 복사 */
  .toolbar {
    position: absolute; top: 15px; left: 50%; transform: translateX(-50%);
    background: white; padding: 8px 15px; border-radius: 50px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; gap: 15px; align-items: center;
    z-index: 10; max-width: 90vw; overflow-x: auto; scrollbar-width: none;
  }
  .group { display: flex; gap: 8px; align-items: center; }
  button { background: #f0f0f0; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; }
  button.active { background: #ffffff; border: 2px solid #333; }
  .color-btn { width: 34px; height: 34px; border: 2px solid #ddd; }
  .save-btn { background: #28a745; color: white; }
  input[type="range"] { width: 50px; }
</style>