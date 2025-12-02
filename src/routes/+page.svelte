<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { getStroke } from 'perfect-freehand';
  import { storage } from '$lib/firebase';
  import { ref, uploadBytes, listAll, getDownloadURL, deleteObject, getMetadata, updateMetadata } from 'firebase/storage';
  import emblaCarouselSvelte from 'embla-carousel-svelte';
  import { showAlert, showConfirm, showLoading } from '$lib/stores/dialog';

  let mainCanvas;
  let tempCanvas;
  let mainCtx;
  let tempCtx;
  let isDrawing = false;
  let points = []; 

  // --- 상태 관리 ---
  let history = [];
  let currentStep = -1; 
  let currentTool = 'pen';
  let lastColor = '#000000'; 
  
  let isColorPickerOpen = false;
  let showBrushPreview = false;
  let selectedImage = null;
  let cooldownSet = new Set();
  const presetColors = [
    '#000000', '#ffffff', '#808080', '#ff0000', '#ff8800', 
    '#ffff00', '#00ff00', '#008800', '#00ffff', '#0000ff', 
    '#8800ff', '#ff00ff'
  ];
  
  // 갤러리 관련 상태
  let savedDrawings = []; 
  let allImageRefs = [];
  let galleryCursor = 0;
  const PAGE_SIZE = 12;
  let isGalleryLoading = false;
  let isGalleryEnd = false;
  let observerSentinel;

  let emblaApi;
  let now = Date.now(); 

  let color = '#000000';
  let size = 8;
  let isSaving = false;

  // 펜 전용 모드 (Palm Rejection) 상태
  let isPenMode = false;

  // --- [최적화] 스냅샷 관련 변수 ---
  const SNAPSHOT_INTERVAL = 10; // 10회 작업마다 상태 저장
  let snapshots = new Map();    // key: step index, value: ImageData

  onMount(() => {
    mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });
    tempCtx = tempCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', handleKeydown);

    loadGalleryRefs(); 

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isGalleryLoading && !isGalleryEnd) {
        loadMoreImages();
      }
    }, { rootMargin: '200px' });

    if (observerSentinel) observer.observe(observerSentinel);

    const timer = setInterval(() => {
      now = Date.now();
      updateCooldowns();
    }, 60000);

    updateCooldowns();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleKeydown);
      clearInterval(timer);
      observer.disconnect();
    };
  });

  function updateCooldowns() {
    if (typeof localStorage === 'undefined') return;
    const newSet = new Set();
    savedDrawings.forEach(img => {
      const cd = localStorage.getItem(`like_cooldown_${img.name}`);
      if (cd && Date.now() < parseInt(cd)) {
        newSet.add(img.name);
      }
    });
    cooldownSet = newSet;
  }

  async function loadGalleryRefs() {
    try {
      isGalleryLoading = true;
      const listRef = ref(storage, 'drawings/');
      const res = await listAll(listRef);
      
      allImageRefs = res.items.sort((a, b) => {
        const timeA = parseInt(a.name.split('.')[0]) || 0;
        const timeB = parseInt(b.name.split('.')[0]) || 0;
        return timeB - timeA;
      });

      galleryCursor = 0;
      savedDrawings = [];
      isGalleryEnd = allImageRefs.length === 0;
      
      await loadMoreImages();
    } catch (error) {
      console.error("갤러리 목록 로드 실패:", error);
    } finally {
      isGalleryLoading = false;
    }
  }

  async function loadMoreImages() {
    if (isGalleryEnd || galleryCursor >= allImageRefs.length) {
      isGalleryEnd = true;
      return;
    }

    try {
      isGalleryLoading = true;
      const nextRefs = allImageRefs.slice(galleryCursor, galleryCursor + PAGE_SIZE);
      
      const promises = nextRefs.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        let likes = 0;
        try {
          const metadata = await getMetadata(itemRef);
          if (metadata.customMetadata && metadata.customMetadata.likes) {
            likes = parseInt(metadata.customMetadata.likes);
          }
        } catch (e) { console.error(e); }

        const time = parseInt(itemRef.name.split('.')[0]);
        
        return {
          url,
          ref: itemRef,
          name: itemRef.name,
          time: isNaN(time) ? 0 : time,
          likes: likes
        };
      });

      const newItems = await Promise.all(promises);
      
      savedDrawings = [...savedDrawings, ...newItems];
      galleryCursor += PAGE_SIZE;
      
      if (galleryCursor >= allImageRefs.length) {
        isGalleryEnd = true;
      }

      updateCooldowns();
    } catch (error) {
      console.error("이미지 상세 로드 실패:", error);
    } finally {
      isGalleryLoading = false;
    }
  }

  async function handleLike(img) {
    if (cooldownSet.has(img.name)) return;
    img.likes++;
    savedDrawings = savedDrawings;
    const cooldownTime = Date.now() + 60 * 1000;
    localStorage.setItem(`like_cooldown_${img.name}`, cooldownTime.toString());
    cooldownSet.add(img.name);
    cooldownSet = new Set(cooldownSet);

    try {
      await updateMetadata(img.ref, {
        customMetadata: {
          likes: img.likes.toString()
        }
      });
    } catch (error) {
      console.error("좋아요 저장 실패:", error);
      img.likes--;
      savedDrawings = savedDrawings;
      await showAlert("좋아요 반영에 실패했습니다.");
    }
  }

  async function deleteImage(img) {
    const isConfirmed = await showConfirm('정말 삭제하시겠습니까?');
    if (!isConfirmed) return;

    try {
      await deleteObject(img.ref);
      savedDrawings = savedDrawings.filter(item => item !== img);
      allImageRefs = allImageRefs.filter(ref => ref.name !== img.name);
      
      if (selectedImage === img) closeImageModal();
    } catch (error) {
      console.error("삭제 실패:", error);
      await showAlert("삭제에 실패했습니다.");
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

  // --- [최적화] 캔버스 리사이즈 및 스냅샷 초기화 ---
  function resizeCanvas() {
    [mainCanvas, tempCanvas].forEach(canvas => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    });
    
    // 화면 크기가 바뀌면 기존 스냅샷(이미지 데이터)은 좌표가 안 맞으므로 초기화
    snapshots.clear();
    renderCanvas();
  }

  // --- [최적화] 스냅샷 기반 렌더링 함수 ---
  function renderCanvas() {
    if (!mainCtx) return;

    // 1. 현재 단계(currentStep)보다 같거나 작은 가장 최신 스냅샷 찾기
    let startIndex = 0;
    let nearestSnapshot = null;
    
    // 키를 내림차순 정렬하여 가장 가까운 과거의 스냅샷 검색
    const snapshotIndices = Array.from(snapshots.keys()).sort((a, b) => b - a);
    
    for (const index of snapshotIndices) {
      if (index <= currentStep) {
        nearestSnapshot = snapshots.get(index);
        startIndex = index + 1; // 스냅샷 바로 다음 단계부터 그리기 시작
        break;
      }
    }

    // 2. 스냅샷이 있으면 복구, 없으면 백지 초기화
    if (nearestSnapshot) {
      mainCtx.putImageData(nearestSnapshot, 0, 0);
    } else {
      mainCtx.fillStyle = '#ffffff';
      mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
      startIndex = 0;
    }

    // 3. 스냅샷 이후의 작업만 순차적으로 다시 그리기 (부하 감소)
    for (let i = startIndex; i <= currentStep; i++) {
      const action = history[i];
      if (action.type === 'stroke') {
        drawStrokeOnCanvas(mainCtx, action.points, action.color, action.size);
      } else if (action.type === 'fill') {
        floodFill(mainCtx, action.x, action.y, action.color);
      }
    }
  }

  function drawStrokeOnCanvas(ctx, points, strokeColor, strokeSize) {
    const stroke = getStroke(points, {
      size: strokeSize,
      thinning: 0.7, 
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: false, // 실제 하드웨어 압력 우선
      last: true,
    });
    const pathData = getSvgPathFromStroke(stroke);
    const myPath = new Path2D(pathData);
    ctx.fillStyle = strokeColor;
    ctx.fill(myPath);
  }

  function floodFill(ctx, startX, startY, fillColor) {
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const r = parseInt(fillColor.slice(1, 3), 16);
    const g = parseInt(fillColor.slice(3, 5), 16);
    const b = parseInt(fillColor.slice(5, 7), 16);
    const a = 255;

    const startPos = (Math.floor(startY) * w + Math.floor(startX)) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];
    if (startR === r && startG === g && startB === b && startA === a) return;
    const queue = [[Math.floor(startX), Math.floor(startY)]];
    
    while (queue.length) {
      const [x, y] = queue.pop();
      const pos = (y * w + x) * 4;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      if (data[pos] === startR && data[pos+1] === startG && data[pos+2] === startB && data[pos+3] === startA) {
        data[pos] = r;
        data[pos+1] = g;
        data[pos+2] = b;
        data[pos+3] = a;

        queue.push([x + 1, y]);
        queue.push([x - 1, y]);
        queue.push([x, y + 1]);
        queue.push([x, y - 1]);
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  function getEventPoint(e) {
    const rect = tempCanvas.getBoundingClientRect();
    let pressure = e.pressure;
    
    // S펜 외의 입력은 압력 0.5로 고정
    if (e.pointerType !== 'pen') {
        pressure = 0.5;
    } else {
        // S펜이라도 가끔 0이 들어오는 경우 방지 (최소 0.1)
        pressure = Math.max(0.1, pressure); 
    }

    return { 
      x: e.clientX - rect.left, 
      y: e.clientY - rect.top, 
      pressure: pressure
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

  // --- [최적화] 채우기 도구 사용 시 스냅샷 처리 ---
  function startDrawing(e) {
    if (isPenMode && e.pointerType === 'touch') return;

    e.target.setPointerCapture(e.pointerId);

    const point = getEventPoint(e);
    if (isColorPickerOpen) {
      isColorPickerOpen = false;
      return;
    }

    if (currentTool === 'bucket') {
      // Undo 상태에서 그리면 미래의 히스토리와 스냅샷 삭제
      if (currentStep < history.length - 1) {
        history = history.slice(0, currentStep + 1);
        for (const key of snapshots.keys()) {
           if (key > currentStep) snapshots.delete(key);
        }
      }

      history.push({ type: 'fill', x: point.x, y: point.y, color: color });
      currentStep++;
      
      // 메인 캔버스에 바로 채우기 실행
      floodFill(mainCtx, point.x, point.y, color);

      // 스냅샷 저장 주기 체크
      if (currentStep % SNAPSHOT_INTERVAL === 0) {
        const imageData = mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
        snapshots.set(currentStep, imageData);
      }
      return;
    }

    isDrawing = true;
    points = [[point.x, point.y, point.pressure]];
  }

  function draw(e) {
    if (!isDrawing) return;
    if (isPenMode && e.pointerType === 'touch') return;
    
    if(e.cancelable) e.preventDefault();
    
    const coalescedEvents = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    
    for (let event of coalescedEvents) {
        const point = getEventPoint(event);
        points = [...points, [point.x, point.y, point.pressure]];
    }
    
    if (tempCtx) {
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      drawStrokeOnCanvas(tempCtx, points, color, size);
    }
  }

  // --- [최적화] 그리기 종료 및 스냅샷 저장 ---
  function stopDrawing(e) {
    if (!isDrawing) return;
    if (isPenMode && e.pointerType === 'touch' && e.type !== 'pointercancel') return;

    isDrawing = false;
    if (e.target.releasePointerCapture) {
        try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}
    }

    // Undo 후 그리기 시 미래 데이터 정리
    if (currentStep < history.length - 1) {
      history = history.slice(0, currentStep + 1);
      for (const key of snapshots.keys()) {
        if (key > currentStep) snapshots.delete(key);
      }
    }

    history.push({ type: 'stroke', points: points, color: color, size: size });
    currentStep++;
    
    if (tempCtx) tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // [최적화] 전체를 다시 그리지 않고 현재 획만 메인 캔버스에 합성
    drawStrokeOnCanvas(mainCtx, points, color, size);

    // [최적화] 지정된 간격마다 스냅샷 저장
    if (currentStep % SNAPSHOT_INTERVAL === 0) {
      const imageData = mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
      snapshots.set(currentStep, imageData);
    }
    
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

  // --- [최적화] 리셋 시 스냅샷도 초기화 ---
  function resetCanvas() {
    history = [];
    currentStep = -1;
    snapshots.clear(); 
    renderCanvas();
    setTool('pen');
  }

  function toggleColorPicker() {
    isColorPickerOpen = !isColorPickerOpen;
  }

  function selectColor(newColor) {
    lastColor = newColor;
    if (currentTool !== 'eraser') color = lastColor;
    isColorPickerOpen = false; 
  }

  function updateNativeColor(e) {
    lastColor = e.target.value;
    if (currentTool !== 'eraser') color = lastColor;
  }

  function setTool(tool) {
    currentTool = tool;
    if (tool === 'eraser') {
      color = '#ffffff';
    } else {
      color = lastColor;
    }
  }

  function openImageModal(imgObj) {
    selectedImage = imgObj;
  }
  function closeImageModal() {
    selectedImage = null;
  }

  async function createResizedAvifBlob() {
    if (!mainCanvas) return null;
    const MAX_SIZE = 1200;
    let width = mainCanvas.width;
    let height = mainCanvas.height;
    if (width > height) {
      if (width > MAX_SIZE) { height *= MAX_SIZE / width;
        width = MAX_SIZE; }
    } else {
      if (height > MAX_SIZE) { width *= MAX_SIZE / height;
        height = MAX_SIZE; }
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
    if (currentStep < 0) {
      await showAlert('그림을 그려주세요!');
      return;
    }

    const isConfirmed = await showConfirm('그림을 저장하시겠습니까?');
    if (!isConfirmed) return;

    if (isSaving) return;
    isSaving = true;
    showLoading('열심히 저장하고 있어요... 🎨');

    try {
      const blob = await createResizedAvifBlob();
      if (!blob) { 
        await showAlert('이미지 변환 실패'); 
        return;
      }
      
      const filename = `drawings/${Date.now()}.avif`;
      const storageRef = ref(storage, filename);
      const metadata = { customMetadata: { likes: '0' } };
      await uploadBytes(storageRef, blob, metadata);
      
      await showAlert('저장 완료! 15분 이내에 삭제할 수 있습니다!');
      await loadGalleryRefs(); 
      resetCanvas();
    } catch (e) {
      console.error(e);
      await showAlert('저장 실패 😢');
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:window 
  on:pointerup={stopDrawing} 
  on:pointercancel={stopDrawing}
/>

<main>
  {#if showBrushPreview}
    <div 
      class="brush-preview"
      style="
        width: {size}px; 
        height: {size}px; 
        background-color: {currentTool === 'eraser' ? '#ffffff' : color};
        border: {currentTool === 'eraser' ? '2px solid #333' : (color === '#ffffff' ? '2px solid #eee' : 'none')};
      "
    ></div>
  {/if}

  {#if selectedImage}
    <div class="image-modal-backdrop" on:click={closeImageModal} transition:fade={{ duration: 200 }}>
      <div class="image-modal-content" on:click|stopPropagation>
        <img src={selectedImage.url} alt="Full size drawing" />
        
        <div class="modal-header">
          <div class="like-wrapper">
            <span class="like-count">{selectedImage.likes}</span>
            <button 
              class="like-btn" 
              class:disabled={cooldownSet.has(selectedImage.name)}
              on:click={() => handleLike(selectedImage)}
              title="좋아요"
            >
              ♥
            </button>
          </div>

          <button class="modal-close-btn" on:click={closeImageModal}>×</button>
        </div>
      </div>
    </div>
  {/if}

  {#if isColorPickerOpen}
    <div class="color-picker-popup" transition:fade={{ duration: 150 }}>
      <div class="color-grid">
        {#each presetColors as preset}
          <button 
            class="color-swatch" 
            style="background-color: {preset};"
            on:click={() => selectColor(preset)}
            aria-label="색상 선택"
          ></button>
        {/each}
        
        <div class="native-picker-wrapper">
            <label for="native-color" class="rainbow-btn">🌈</label>
            <input 
                id="native-color" 
                type="color" 
                value={lastColor} 
                on:input={updateNativeColor} 
            />
        </div>
      </div>
    </div>
  {/if}

  <div class="toolbar">
    <div class="group">
      <button 
        on:click={() => isPenMode = !isPenMode} 
        class:active={isPenMode}
        title={isPenMode ? "펜 전용 모드 켜짐 (손터치 무시)" : "펜/손 모두 사용"}
        style="font-size: 1.2rem;"
      >
        {#if isPenMode}
          🖊️
        {:else}
          👆
        {/if}
      </button>

      <button 
        class="color-btn" 
        style="background-color: {lastColor}; border: 2px solid #ddd;"
        on:click={toggleColorPicker}
        title="색상 선택"
      ></button>
      
      <button 
        on:click={() => setTool('pen')} 
        class:active={currentTool === 'pen'} 
        title="펜"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
      </button>

      <button 
        on:click={() => setTool('eraser')} 
        class:active={currentTool === 'eraser'} 
        title="지우개"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
      </button>

      <button 
        on:click={() => setTool('bucket')} 
        class:active={currentTool === 'bucket'} 
        title="채우기"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
          <path d="m5 2 5 5"/>
          <path d="M2 13h15"/>
          <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
        </svg>
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
    on:pointerdown={startDrawing}
    on:pointermove={draw}
    on:pointerup={stopDrawing}
    on:pointercancel={stopDrawing}
  ></canvas>

  <div class="gallery-wrapper">
    <div class="embla" use:emblaCarouselSvelte={{ options: emblaOptions, plugins: [] }} on:emblaInit={onInit}>
      <div class="embla__container">
        {#each savedDrawings as img}
          <div class="embla__slide">
            <div class="image-card" on:click={() => openImageModal(img)}>
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
        
        {#if !isGalleryEnd}
          <div class="embla__slide observer-slide" bind:this={observerSentinel}>
            <div class="loading-placeholder">
              <div class="spinner small"></div>
            </div>
          </div>
        {/if}

        {#if savedDrawings.length === 0 && isGalleryEnd}
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

  /* 이미지 모달 스타일 */
  .image-modal-backdrop {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 200;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .image-modal-content {
    position: relative;
    width: auto;
    max-width: 90%;
    max-height: 90vh;
    padding: 10px;
    box-sizing: border-box;
  }
  .image-modal-content img {
    width: 100%; height: auto; max-height: 90vh;
    object-fit: contain;
    display: block;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    background: white;
  }

  .modal-header {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 201;
  }

  .like-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(0, 0, 0, 0.6);
    padding: 4px 10px;
    border-radius: 20px;
    color: white;
  }
  .like-count {
    font-size: 14px;
    font-weight: bold;
  }
  
  button.like-btn {
    background: transparent !important;
    border: none;
    color: #ff4d4d;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: auto;
    height: auto;
    display: flex;
    align-items: center;
    transition: transform 0.2s, color 0.2s;
  }
  button.like-btn:hover {
    background: transparent !important;
    transform: scale(1.2);
  }
  button.like-btn.disabled {
    color: #ccc;
    cursor: not-allowed;
    transform: none;
    background: transparent !important;
  }

  .modal-close-btn {
    background: rgba(0, 0, 0, 0.6);
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }
  .modal-close-btn:hover {
    background: rgba(0, 0, 0, 0.8);
  }

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
  .toolbar::-webkit-scrollbar { display: none; }

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

  .color-btn {
    width: 34px; height: 34px;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    flex-shrink: 0;
  }

  .color-picker-popup {
    position: absolute;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 15px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    z-index: 20;
    width: 200px;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
    justify-items: center;
  }

  .color-swatch {
    width: 30px; height: 30px;
    border-radius: 50%;
    border: 2px solid #eee;
    cursor: pointer;
    padding: 0;
  }
  
  .native-picker-wrapper {
    position: relative;
    width: 30px; height: 30px;
  }
  .rainbow-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%; height: 100%;
    font-size: 18px;
    cursor: pointer;
    background: #f0f0f0;
    border-radius: 50%;
  }
  #native-color {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    opacity: 0; cursor: pointer;
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
  .spinner.small {
    width: 24px;
    height: 24px;
    border: 3px solid #ddd;
    border-top-color: #333;
    border-radius: 50%;
  }
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  input[type="range"] {
    width: 50px;
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
    width: 100%; height: 100%;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 2px solid #eee;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .image-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .empty-message { padding: 20px; color: #888; font-size: 0.9rem; }

  .delete-img-btn {
    position: absolute;
    top: 5px; right: 5px;
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

  .observer-slide {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .loading-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    border-radius: 12px;
  }

  @media (max-width: 600px) {
    .toolbar {
      gap: 10px;
      padding: 8px 10px;
      max-width: 95vw;
    }
    .group {
      gap: 5px;
    }
    button, .color-btn {
      width: 32px;
      height: 32px;
    }
    input[type="range"] {
      width: 40px;
    }
  }
</style>