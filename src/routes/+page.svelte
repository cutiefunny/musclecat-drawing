<script>
  import { onMount } from 'svelte';
  import { getStroke } from 'perfect-freehand';
  
  // Firebase
  import { storage, db } from '$lib/firebase';
  import { ref, uploadBytes, listAll, getDownloadURL, deleteObject, getMetadata, updateMetadata } from 'firebase/storage';
  import { doc, onSnapshot } from 'firebase/firestore';
  
  // Stores
  import { currentTool, color, size, isPenMode, isScreensaverOn, isSaving, lastColor } from '$lib/stores/drawing';
  import { savedDrawings, isGalleryLoading, isGalleryEnd, cooldownSet } from '$lib/stores/gallery';
  import { showAlert, showConfirm, showLoading } from '$lib/stores/dialog';

  // Components (리팩토링된 컴포넌트들)
  import Toolbar from '$lib/components/Toolbar.svelte';
  import ColorPicker from '$lib/components/ColorPicker.svelte';
  import Screensaver from '$lib/components/Screensaver.svelte';
  import Gallery from '$lib/components/Gallery.svelte';
  import ImageModal from '$lib/components/ImageModal.svelte';

  // --- 변수 선언 ---
  let mainCanvas, tempCanvas, mainCtx, tempCtx;
  let isDrawing = false;
  let points = []; 
  let history = [];
  let currentStep = -1;
  let snapshots = new Map();
  const SNAPSHOT_INTERVAL = 10;

  // 갤러리 로딩 상태용
  let allImageRefs = [];
  let galleryCursor = 0;
  const PAGE_SIZE = 12;
  
  // UI 상태
  let selectedImage = null;

  // 스크린세이버 상태
  let lastActivityTime = Date.now();
  let screensaverIndex = 0;
  let screensaverTimer, slideInterval;
  let IDLE_TIMEOUT = 60 * 1000; 
  let SLIDE_DURATION = 5000;

  onMount(() => {
    mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });
    tempCtx = tempCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', handleKeydown);

    // 사용자 동작 감지
    const activityEvents = ['mousedown', 'mousemove', 'touchstart', 'click', 'keydown', 'scroll'];
    activityEvents.forEach(event => window.addEventListener(event, handleUserActivity));

    // 유휴 상태 체크
    screensaverTimer = setInterval(checkIdle, 1000);

    // Firestore 설정 구독
    const unsubSettings = onSnapshot(doc(db, "global", "settings"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        IDLE_TIMEOUT = (data.idleTimeoutSec || 60) * 1000;
        const newSlideDuration = (data.slideDurationSec || 5) * 1000;

        if ($isScreensaverOn && SLIDE_DURATION !== newSlideDuration) {
          clearInterval(slideInterval);
          slideInterval = setInterval(() => {
            screensaverIndex = (screensaverIndex + 1) % $savedDrawings.length;
          }, newSlideDuration);
        }
        SLIDE_DURATION = newSlideDuration;
      }
    });

    loadGalleryRefs(); 
    updateCooldowns();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleKeydown);
      activityEvents.forEach(event => window.removeEventListener(event, handleUserActivity));
      clearInterval(screensaverTimer);
      clearInterval(slideInterval);
      unsubSettings();
    };
  });

  // --- 스크린세이버 로직 ---
  function handleUserActivity() {
    lastActivityTime = Date.now();
    if ($isScreensaverOn) stopScreensaver();
  }

  function checkIdle() {
    if (!$isScreensaverOn && Date.now() - lastActivityTime > IDLE_TIMEOUT) {
      startScreensaver();
    }
  }

  function startScreensaver() {
    if ($savedDrawings.length === 0) return;
    $isScreensaverOn = true;
    resetCanvas();
    screensaverIndex = 0;
    slideInterval = setInterval(() => {
      screensaverIndex = (screensaverIndex + 1) % $savedDrawings.length;
    }, SLIDE_DURATION);
  }

  function stopScreensaver() {
    $isScreensaverOn = false;
    clearInterval(slideInterval);
  }

  // --- 갤러리 로직 ---
  function updateCooldowns() {
    if (typeof localStorage === 'undefined') return;
    const newSet = new Set();
    $savedDrawings.forEach(img => {
      const cd = localStorage.getItem(`like_cooldown_${img.name}`);
      if (cd && Date.now() < parseInt(cd)) newSet.add(img.name);
    });
    $cooldownSet = newSet;
  }

  async function loadGalleryRefs() {
    try {
      $isGalleryLoading = true;
      const listRef = ref(storage, 'drawings/');
      const res = await listAll(listRef);
      allImageRefs = res.items.sort((a, b) => {
        const timeA = parseInt(a.name.split('.')[0]) || 0;
        const timeB = parseInt(b.name.split('.')[0]) || 0;
        return timeB - timeA;
      });
      galleryCursor = 0;
      $savedDrawings = [];
      $isGalleryEnd = allImageRefs.length === 0;
      await loadMoreImages();
    } catch (error) {
      console.error("갤러리 목록 로드 실패:", error);
    } finally {
      $isGalleryLoading = false;
    }
  }

  async function loadMoreImages() {
    if ($isGalleryEnd || galleryCursor >= allImageRefs.length) {
      $isGalleryEnd = true;
      return;
    }
    try {
      $isGalleryLoading = true;
      const nextRefs = allImageRefs.slice(galleryCursor, galleryCursor + PAGE_SIZE);
      const promises = nextRefs.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        let likes = 0;
        try {
          const metadata = await getMetadata(itemRef);
          if (metadata.customMetadata?.likes) likes = parseInt(metadata.customMetadata.likes);
        } catch (e) {}
        const time = parseInt(itemRef.name.split('.')[0]);
        return { url, ref: itemRef, name: itemRef.name, time: isNaN(time) ? 0 : time, likes };
      });

      const newItems = await Promise.all(promises);
      $savedDrawings = [...$savedDrawings, ...newItems];
      galleryCursor += PAGE_SIZE;
      if (galleryCursor >= allImageRefs.length) $isGalleryEnd = true;
      updateCooldowns();
    } catch (error) {
      console.error("이미지 상세 로드 실패:", error);
    } finally {
      $isGalleryLoading = false;
    }
  }

  // --- 이벤트 핸들러 (컴포넌트에서 호출) ---
  async function handleLike(event) {
    const img = event.detail;
    if ($cooldownSet.has(img.name)) return;
    
    // UI 낙관적 업데이트
    img.likes++;
    $savedDrawings = $savedDrawings; // Svelte 반응성 트리거

    const cooldownTime = Date.now() + 60 * 1000;
    localStorage.setItem(`like_cooldown_${img.name}`, cooldownTime.toString());
    $cooldownSet.add(img.name);
    $cooldownSet = new Set($cooldownSet);

    try {
      await updateMetadata(img.ref, { customMetadata: { likes: img.likes.toString() } });
    } catch (error) {
      console.error("좋아요 실패:", error);
      img.likes--;
      $savedDrawings = $savedDrawings;
      await showAlert("좋아요 실패");
    }
  }

  async function handleDelete(event) {
    const img = event.detail;
    if (!(await showConfirm('정말 삭제하시겠습니까?'))) return;

    try {
      await deleteObject(img.ref);
      $savedDrawings = $savedDrawings.filter(item => item !== img);
      allImageRefs = allImageRefs.filter(ref => ref.name !== img.name);
      if (selectedImage === img) selectedImage = null;
    } catch (error) {
      console.error("삭제 실패:", error);
      await showAlert("삭제 실패");
    }
  }

  // --- 캔버스 로직 (그리기, Undo/Redo) ---
  function handleKeydown(e) {
    if ($isScreensaverOn) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') e.shiftKey ? redo() : undo();
    else if ((e.ctrlKey || e.metaKey) && e.key === 'y') redo();
  }

  function resizeCanvas() {
    [mainCanvas, tempCanvas].forEach(c => { if (c) { c.width = window.innerWidth; c.height = window.innerHeight; } });
    snapshots.clear();
    renderCanvas();
  }

  function renderCanvas() {
    if (!mainCtx) return;
    let startIndex = 0;
    let nearestSnapshot = null;
    const snapshotIndices = Array.from(snapshots.keys()).sort((a, b) => b - a);
    
    for (const index of snapshotIndices) {
      if (index <= currentStep) {
        nearestSnapshot = snapshots.get(index);
        startIndex = index + 1;
        break;
      }
    }

    if (nearestSnapshot) mainCtx.putImageData(nearestSnapshot, 0, 0);
    else {
      mainCtx.fillStyle = '#ffffff';
      mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
      startIndex = 0;
    }

    for (let i = startIndex; i <= currentStep; i++) {
      const action = history[i];
      if (action.type === 'stroke') drawStrokeOnCanvas(mainCtx, action.points, action.color, action.size);
      else if (action.type === 'fill') floodFill(mainCtx, action.x, action.y, action.color);
    }
  }

  function drawStrokeOnCanvas(ctx, points, strokeColor, strokeSize) {
    const stroke = getStroke(points, { size: strokeSize, thinning: 0.7, smoothing: 0.5, streamline: 0.5, simulatePressure: false, last: true });
    const d = stroke.length ? `M${stroke[0].join(',')}Q` + stroke.reduce((acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y1 + y0) / 2);
        return acc;
      }, []).join(',') + 'Z' : '';
    
    const myPath = new Path2D(d);
    ctx.fillStyle = strokeColor;
    ctx.fill(myPath);
  }

  function floodFill(ctx, startX, startY, fillColor) {
    // (기존 floodFill 로직 동일)
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h), data = imageData.data;
    const r = parseInt(fillColor.slice(1, 3), 16), g = parseInt(fillColor.slice(3, 5), 16), b = parseInt(fillColor.slice(5, 7), 16);
    const startPos = (Math.floor(startY) * w + Math.floor(startX)) * 4;
    const [startR, startG, startB, startA] = [data[startPos], data[startPos+1], data[startPos+2], data[startPos+3]];
    if (startR === r && startG === g && startB === b && startA === 255) return;

    const queue = [[Math.floor(startX), Math.floor(startY)]];
    while(queue.length) {
        const [x, y] = queue.pop();
        const pos = (y * w + x) * 4;
        if(x<0 || x>=w || y<0 || y>=h) continue;
        if(data[pos] === startR && data[pos+1] === startG && data[pos+2] === startB && data[pos+3] === startA) {
            data[pos] = r; data[pos+1] = g; data[pos+2] = b; data[pos+3] = 255;
            queue.push([x+1,y], [x-1,y], [x,y+1], [x,y-1]);
        }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // --- 입력 이벤트 처리 ---
  function getEventPoint(e) {
    const rect = tempCanvas.getBoundingClientRect();
    let pressure = e.pressure;
    if (e.pointerType !== 'pen') pressure = 0.5;
    else pressure = Math.max(0.1, pressure);
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure };
  }

  function startDrawing(e) {
    if ($isScreensaverOn) return;
    if ($isPenMode && e.pointerType === 'touch') return;
    e.target.setPointerCapture(e.pointerId);
    
    // 컬러피커 닫기
    if (globalThis.$isColorPickerOpen) { globalThis.$isColorPickerOpen = false; return; }

    const point = getEventPoint(e);

    if ($currentTool === 'bucket') {
      if (currentStep < history.length - 1) {
        history = history.slice(0, currentStep + 1);
        snapshots.forEach((_, k) => { if(k > currentStep) snapshots.delete(k) });
      }
      history.push({ type: 'fill', x: point.x, y: point.y, color: $color });
      currentStep++;
      floodFill(mainCtx, point.x, point.y, $color);
      if (currentStep % SNAPSHOT_INTERVAL === 0) snapshots.set(currentStep, mainCtx.getImageData(0,0,mainCanvas.width, mainCanvas.height));
      return;
    }

    isDrawing = true;
    points = [[point.x, point.y, point.pressure]];
  }

  function draw(e) {
    if (!isDrawing) return;
    if ($isPenMode && e.pointerType === 'touch') return;
    if(e.cancelable) e.preventDefault();
    
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (let ev of events) {
      const p = getEventPoint(ev);
      points.push([p.x, p.y, p.pressure]);
    }
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    drawStrokeOnCanvas(tempCtx, points, $color, $size);
  }

  function stopDrawing(e) {
    if (!isDrawing) return;
    if ($isPenMode && e.pointerType === 'touch' && e.type !== 'pointercancel') return;
    isDrawing = false;
    try { e.target.releasePointerCapture(e.pointerId); } catch {}

    if (currentStep < history.length - 1) {
        history = history.slice(0, currentStep + 1);
        snapshots.forEach((_, k) => { if(k > currentStep) snapshots.delete(k) });
    }
    history.push({ type: 'stroke', points, color: $color, size: $size });
    currentStep++;
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    drawStrokeOnCanvas(mainCtx, points, $color, $size);
    if (currentStep % SNAPSHOT_INTERVAL === 0) snapshots.set(currentStep, mainCtx.getImageData(0,0,mainCanvas.width, mainCanvas.height));
    points = [];
  }

  function undo() { if(currentStep >= 0) { currentStep--; renderCanvas(); } }
  function redo() { if(currentStep < history.length - 1) { currentStep++; renderCanvas(); } }
  function resetCanvas() { history = []; currentStep = -1; snapshots.clear(); renderCanvas(); $currentTool='pen'; }

  async function saveToFirebase() {
    if (currentStep < 0) { await showAlert('그림을 그려주세요!'); return; }
    if (!(await showConfirm('그림을 저장하시겠습니까?'))) return;
    
    $isSaving = true;
    showLoading('열심히 저장하고 있어요... 🎨');
    try {
      const tempC = document.createElement('canvas');
      // (리사이징 로직 생략 - 기존과 동일하게 구현 필요 시 추가)
      tempC.width = mainCanvas.width; tempC.height = mainCanvas.height;
      tempC.getContext('2d').drawImage(mainCanvas, 0, 0);
      
      const blob = await new Promise(r => tempC.toBlob(r, 'image/avif', 0.8));
      const filename = `drawings/${Date.now()}.avif`;
      await uploadBytes(ref(storage, filename), blob, { customMetadata: { likes: '0' } });
      
      await showAlert('저장 완료! 15분 이내에 삭제할 수 있습니다!');
      await loadGalleryRefs();
      resetCanvas();
    } catch(e) {
      console.error(e); await showAlert('저장 실패');
    } finally {
      $isSaving = false;
    }
  }
</script>

<svelte:window on:pointerup={stopDrawing} on:pointercancel={stopDrawing}/>

<main>
  <Screensaver 
    index={screensaverIndex} 
    on:stop={stopScreensaver} 
  />
  
  <ColorPicker />

  {#if selectedImage}
    <ImageModal 
      img={selectedImage} 
      on:close={() => selectedImage = null}
      on:like={handleLike}
    />
  {/if}

  <Toolbar 
    canUndo={currentStep >= 0} 
    canRedo={currentStep < history.length - 1} 
    isSaving={$isSaving}
    on:undo={undo} 
    on:redo={redo} 
    on:save={saveToFirebase} 
  />

  <canvas bind:this={mainCanvas} class="main-canvas"></canvas>
  <canvas bind:this={tempCanvas} class="temp-canvas" 
    on:pointerdown={startDrawing} on:pointermove={draw} 
    on:pointerup={stopDrawing} on:pointercancel={stopDrawing}
  ></canvas>

  <Gallery 
    on:open={(e) => selectedImage = e.detail}
    on:delete={handleDelete}
    on:loadMore={loadMoreImages}
  />
</main>

<style>
  :global(body) { margin: 0; padding: 0; overflow: hidden; }
  main { position: relative; width: 100vw; height: 100vh; background: white; }
  canvas { display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; touch-action: none; }
  .temp-canvas { z-index: 2; cursor: crosshair; }
  .main-canvas { z-index: 1; }
</style>