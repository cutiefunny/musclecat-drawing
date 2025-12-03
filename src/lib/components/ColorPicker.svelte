<script>
  import { fade } from 'svelte/transition';
  import { color, lastColor, isColorPickerOpen, currentTool } from '$lib/stores/drawing';

  const presetColors = [
    '#000000', '#ffffff', '#808080', '#ff0000', '#ff8800', 
    '#ffff00', '#00ff00', '#008800', '#00ffff', '#0000ff', 
    '#8800ff', '#ff00ff'
  ];

  function selectColor(newColor) {
    $lastColor = newColor;
    if ($currentTool !== 'eraser') $color = newColor;
    $isColorPickerOpen = false;
  }

  function updateNativeColor(e) {
    $lastColor = e.target.value;
    if ($currentTool !== 'eraser') $color = e.target.value;
  }
</script>

{#if $isColorPickerOpen}
  <div class="color-picker-popup" transition:fade={{ duration: 150 }}>
    <div class="color-grid">
      {#each presetColors as preset}
        <button class="color-swatch" style="background-color: {preset};" on:click={() => selectColor(preset)} aria-label="색상 선택"></button>
      {/each}
      <div class="native-picker-wrapper">
          <label for="native-color" class="rainbow-btn">🌈</label>
          <input id="native-color" type="color" value={$lastColor} on:input={updateNativeColor} />
      </div>
    </div>
  </div>
{/if}

<style>
  /* +page.svelte의 .color-picker-popup 관련 스타일을 그대로 가져옴 */
  .color-picker-popup {
    position: absolute; top: 70px; left: 50%; transform: translateX(-50%);
    background: white; padding: 15px; border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 20; width: 200px;
  }
  .color-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; justify-items: center; }
  .color-swatch { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #eee; cursor: pointer; padding: 0; }
  .native-picker-wrapper { position: relative; width: 30px; height: 30px; }
  .rainbow-btn { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 18px; cursor: pointer; background: #f0f0f0; border-radius: 50%; }
  #native-color { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
</style>