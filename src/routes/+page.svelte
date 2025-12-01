<script>
  import { onMount } from 'svelte';
  import { getStroke } from 'perfect-freehand';
  import { storage } from '$lib/firebase';
  import { ref, uploadBytes, listAll, getDownloadURL, deleteObject } from 'firebase/storage';
  import emblaCarouselSvelte from 'embla-carousel-svelte';

  let mainCanvas;
  let tempCanvas;
  let mainCtx;
  let tempCtx;

  let isDrawing = false;
  let points = []; 

  // --- 상태 관리 ---
  let history = [];     
  let currentStep = -1; 
  let isEraser = false; 
  let lastColor = '#000000'; 
  let showBrushPreview = false;

  // 갤러리 데이터 & 시간 체크
  let savedDrawings = []; 
  let emblaApi;
  let now = Date.now(); 

  // 옵션
  let color = '#000000';
  let size = 5;
  let isSaving = false;

  onMount(() => {
    mainCtx = mainCanvas.getContext('2d');
    tempCtx = tempCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', handleKeydown);

    loadGallery();

    const timer = setInterval(() => {
      now = Date.now();
    }, 60000);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleKeydown);
      clearInterval(timer);
    };
  });

  async function loadGallery() {
    try {
      const listRef = ref(storage, 'drawings/');
      const res = await listAll(listRef);
      
      const promises = res.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        const time = parseInt(itemRef.name.split('.')[0]);
        return {
          url,
          ref: itemRef,
          time: isNaN(time) ? 0 : time
        };
      });

      const items = await Promise.all(promises);
      savedDrawings = items.sort((a, b) => b.time - a.time);
      
    } catch (error) {
      console.error("갤러리 로드 실패:", error);
    }
  }

  async function deleteImage(img) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteObject(img.ref);
      savedDrawings = savedDrawings.filter(item => item !== img);
    } catch (error) {
      console.error("삭제 실패:", error);
      alert("삭제에 실패했습니다.");
    }
  }
  
  const emblaOptions = { loop: false, dragFree: true, containScroll: 'trimSnaps' };

  function onInit(event) { emblaApi = event.detail; }

  function handleKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.shiftKey ? redo() : undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y')) {
      redo();
    }
  }

  function resizeCanvas() {
    [mainCanvas, tempCanvas].forEach(canvas => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    });
    renderCanvas();
  }

  function renderCanvas() {
    if (!mainCtx) return;
    mainCtx.fillStyle = '#ffffff';
    mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

    for (let i = 0; i <= currentStep; i++) {
      const strokeData = history[i];
      drawStrokeOnCanvas(mainCtx, strokeData.points, strokeData.color, strokeData.size);
    }
  }

  function drawStrokeOnCanvas(ctx, points, strokeColor, strokeSize) {
    const stroke = getStroke(points, {
      size: strokeSize,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });
    const pathData = getSvgPathFromStroke(stroke);
    const myPath = new Path2D(pathData);
    ctx.fillStyle = strokeColor;
    ctx.fill(myPath);
  }

  function getEventPoint(e) {
    const rect = tempCanvas.getBoundingClientRect();
    let clientX, clientY, pressure = 0.5;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      pressure = e.touches[0].force || 0.5;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
      pressure = 0.5;
    }

    return { 
      x: clientX - rect.left, 
      y: clientY - rect.top, 
      pressure 
    };
  }

  function getSvgPathFromStroke(stroke) {
    if (!stroke.length) return '';
    const d = stroke.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y1 + y0) / 2);
        return acc;
      },
      ['M', ...stroke[0], 'Q']
    );
    d.push('Z');
    return d.join(' ');
  }

  function startDrawing(e) {
    isDrawing = true;
    const point = getEventPoint(e);
    points = [[point.x, point.y, point.pressure]];
  }

  function draw(e) {
    if (!isDrawing) return;
    if(e.cancelable) e.preventDefault();
    
    const point = getEventPoint(e);
    points = [...points, [point.x, point.y, point.pressure]];
    if (tempCtx) {
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      drawStrokeOnCanvas(tempCtx, points, color, size);
    }
  }

  function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    if (currentStep < history.length - 1) {
      history = history.slice(0, currentStep + 1);
    }
    history.push({ points: points, color: color, size: size });
    currentStep++;
    if (tempCtx) tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    renderCanvas();
    points = [];
  }

  function undo() {
    if (currentStep >= 0) {
      currentStep--;
      renderCanvas();
    }
  }

  function redo() {
    if (currentStep < history.length - 1) {
      currentStep++;
      renderCanvas();
    }
  }

  function clearCanvas() {
    history = [];
    currentStep = -1;
    renderCanvas();
    if (isEraser) toggleEraser();
  }

  function updateColor(e) {
    color = e.target.value;
    if (isEraser) isEraser = false;
  }

  function toggleEraser() {
    if (isEraser) {
      isEraser = false;
      color = lastColor;
    } else {
      isEraser = true;
      lastColor = color;
      color = '#ffffff'; 
    }
  }

  async function createResizedAvifBlob() {
    if (!mainCanvas) return null;
    const MAX_SIZE = 600;
    let width = mainCanvas.width;
    let height = mainCanvas.height;
    if (width > height) {
      if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
    } else {
      if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
    }
    const tempC = document.createElement('canvas');
    tempC.width = width;
    tempC.height = height;
    const tCtx = tempC.getContext('2d');
    if (!tCtx) return null;
    tCtx.drawImage(mainCanvas, 0, 0, width, height);
    return new Promise((resolve) => tempC.toBlob((b) => resolve(b), 'image/avif', 0.8));
  }

  async function saveToFirebase() {
    // [수정됨] currentStep이 0보다 작으면(초기 상태 or 모두 Undo됨) 저장 불가
    if (currentStep < 0) {
      alert('그림을 그려주세요!');
      return;
    }

    if (isSaving) return;
    isSaving = true;
    try {
      const blob = await createResizedAvifBlob();
      if (!blob) { alert('이미지 변환 실패'); return; }
      
      const filename = `drawings/${Date.now()}.avif`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      
      alert('저장 완료! 새 종이를 준비했습니다.');
      await loadGallery(); 
      clearCanvas(); 
      
    } catch (e) {
      console.error(e);
      alert('저장 실패');
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:window 
  on:mouseup={stopDrawing} 
  on:touchend={stopDrawing} 
/>

<main>
  {#if showBrushPreview}
    <div 
      class="brush-preview"
      style="
        width: {size}px; 
        height: {size}px; 
        background-color: {isEraser ? '#ffffff' : color};
        border: {isEraser ? '2px solid #333' : (color === '#ffffff' ? '2px solid #eee' : 'none')};
      "
    ></div>
  {/if}

  <div class="toolbar">
    <div class="group">
      <input type="color" value={isEraser ? lastColor : color} on:input={updateColor} title="색상 선택" />
      
      <button 
        on:click={toggleEraser} 
        class:active={isEraser} 
        title={isEraser ? "지우개 모드 켜짐" : "브러시 모드"}
      >
        {#if isEraser}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" />
            <path d="m5 11 9 9" />
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        {/if}
      </button>

      <input 
        type="range" 
        min="1" 
        max="100" 
        bind:value={size} 
        on:mousedown={() => showBrushPreview = true}
        on:touchstart={() => showBrushPreview = true}
        on:mouseup={() => showBrushPreview = false}
        on:touchend={() => showBrushPreview = false}
        on:change={() => showBrushPreview = false}
        title="브러시 크기" 
      />
    </div>
    
    <div class="group">
      <button on:click={undo} disabled={currentStep < 0} title="실행 취소">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
      </button>
      <button on:click={redo} disabled={currentStep >= history.length - 1} title="다시 실행">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
      </button>
      <button on:click={clearCanvas} title="모두 지우기">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      </button>
      
      <button 
        on:click={saveToFirebase} 
        disabled={isSaving || currentStep < 0} 
        class="save-btn" 
        title={isSaving ? "저장 중..." : (currentStep < 0 ? "그림을 그려주세요" : "저장하기")}
      >
        {#if isSaving}
          <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        {/if}
      </button>
    </div>
  </div>

  <canvas bind:this={mainCanvas} class="main-canvas"></canvas>
  <canvas
    bind:this={tempCanvas}
    class="temp-canvas"
    on:mousedown={startDrawing}
    on:mousemove={draw}
    on:touchstart|nonpassive={startDrawing}
    on:touchmove|nonpassive={draw}
  ></canvas>

  <div class="gallery-wrapper">
    <div class="embla" use:emblaCarouselSvelte={{ options: emblaOptions, plugins: [] }} on:emblaInit={onInit}>
      <div class="embla__container">
        {#each savedDrawings as img}
          <div class="embla__slide">
            <div class="image-card">
              <img src={img.url} alt="Saved drawing" loading="lazy" />
              {#if (now - img.time) < 15 * 60 * 1000}
                <button 
                  class="delete-img-btn" 
                  on:click|stopPropagation={() => deleteImage(img)}
                  title="삭제하기"
                >
                  ×
                </button>
              {/if}
            </div>
          </div>
        {/each}
        {#if savedDrawings.length === 0}
            <div class="empty-message">저장된 그림이 없습니다.</div>
        {/if}
      </div>
    </div>
  </div>
</main>

<style>
  :global(body) { margin: 0; padding: 0; overflow: hidden; }
  main { position: relative; width: 100vw; height: 100vh; background: white; }
  canvas { display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; touch-action: none; }
  .temp-canvas { z-index: 2; cursor: crosshair; }
  .main-canvas { z-index: 1; }

  .brush-preview {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 100;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
  }

  .toolbar {
    position: absolute;
    top: 15px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 8px 15px;
    border-radius: 50px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    gap: 15px;
    align-items: center;
    z-index: 10;
    max-width: 90vw;
    overflow-x: auto;
    white-space: nowrap;
    scrollbar-width: none;
  }
  .toolbar::-webkit-scrollbar {
    display: none;
  }

  .group { display: flex; gap: 8px; align-items: center; }

  button {
    background: #f0f0f0;
    color: #333;
    border: 2px solid transparent;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  button:hover:not(:disabled) { background: #e0e0e0; transform: scale(1.1); }
  button:disabled { opacity: 0.3; cursor: not-allowed; }

  button.active {
    background: #ffffff;
    border-color: #333;
    color: #000;
    transform: scale(1.1);
    box-shadow: 0 0 5px rgba(0,0,0,0.2);
  }

  .save-btn {
    background: #28a745;
    color: white;
  }
  .save-btn:hover:not(:disabled) {
    background: #218838;
    transform: scale(1.1);
  }
  
  .spinner {
    animation: rotate 1s linear infinite;
  }
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  input[type="range"] {
    width: 80px;
    flex-shrink: 0;
  }

  .gallery-wrapper {
    position: absolute;
    bottom: 20px;
    left: 0;
    width: 100%;
    height: 120px;
    z-index: 10;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(5px);
    border-top: 1px solid #eee;
    padding: 10px 0;
    box-sizing: border-box;
  }
  .embla { overflow: hidden; width: 100%; height: 100%; }
  .embla__container { display: flex; padding-left: 20px; gap: 10px; }
  .embla__slide { flex: 0 0 auto; width: 100px; height: 100px; }
  
  .image-card {
    position: relative;
    width: 100%;
    height: 100%;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 2px solid #eee;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .image-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .empty-message { padding: 20px; color: #888; font-size: 0.9rem; }

  .delete-img-btn {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 24px;
    height: 24px;
    background: rgba(255, 68, 68, 0.9);
    color: white;
    border-radius: 50%;
    border: none;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  .delete-img-btn:hover {
    background: #cc0000;
    transform: scale(1.1);
  }
</style>