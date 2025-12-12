<script>
  import { onMount, onDestroy } from 'svelte';
  import { getStroke } from 'perfect-freehand';
  // Firebase
  import { storage, db } from '$lib/firebase';
  // [수정] Firestore 함수 추가
  import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
  import { doc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';
  
  // Stores
  import { currentTool, color, size, isPenMode, isScreensaverOn, isSaving, lastColor, isColorPickerOpen, showBrushPreview } from '$lib/stores/drawing';
  import { savedDrawings, isGalleryLoading, isGalleryEnd, cooldownSet } from '$lib/stores/gallery';
  import { showAlert, showConfirm, showLoading } from '$lib/stores/dialog';
  
  // Components
  import Toolbar from '$lib/components/Toolbar.svelte';
  import ColorPicker from '$lib/components/ColorPicker.svelte';
  import Screensaver from '$lib/components/Screensaver.svelte';
  import Gallery from '$lib/components/Gallery.svelte';
  import ImageModal from '$lib/components/ImageModal.svelte';

  // now playing
  import NowPlayingWidget from '$lib/components/NowPlayingWidget.svelte';

  // --- 변수 선언 ---
  let mainCanvas, tempCanvas, mainCtx, tempCtx;
  let isDrawing = false;
  let points = [];
  let history = [];
  let currentStep = -1;
  let snapshots = new Map();
  const SNAPSHOT_INTERVAL = 10;

  // 갤러리 로딩 상태용 (이제 Firestore로 관리되므로 갤러리 컴포넌트에서 직접 로드함)
  
  // UI 상태
  let selectedImage = null;
  let isMobile = false; // [추가] 모바일 상태 감지 변수

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
    checkMobile(); // [추가] 초기 모바일 여부 확인

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('resize', checkMobile); // [추가] 리사이즈 이벤트 등록
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

    updateCooldowns();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('resize', checkMobile); // [추가] 리스너 제거
      window.removeEventListener('keydown', handleKeydown);
      activityEvents.forEach(event => window.removeEventListener(event, handleUserActivity));
      clearInterval(screensaverTimer);
      clearInterval(slideInterval);
      unsubSettings();
    };
  });

  // [추가] 모바일 감지 함수
  function checkMobile() {
    isMobile = window.innerWidth <= 600;
  }

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

  // --- 캔버스 로직 ---
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
            data[pos] = r;
            data[pos+1] = g; data[pos+2] = b; data[pos+3] = 255;
            queue.push([x+1,y], [x-1,y], [x,y+1], [x,y-1]);
        }
    }
    ctx.putImageData(imageData, 0, 0);
  }

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
    if ($isColorPickerOpen) { 
      $isColorPickerOpen = false;
      return; 
    }

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
    try { e.target.releasePointerCapture(e.pointerId);
    } catch {}

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

  // [수정] Firestore에 저장하는 로직 추가
  async function saveToFirebase() {
    if (currentStep < 0) { await showAlert('그림을 그려주세요!'); return; }
    if (!(await showConfirm('그림을 저장하시겠습니까?'))) return;
    
    $isSaving = true;
    showLoading('열심히 저장하고 있어요... 🎨');
    try {
      const tempC = document.createElement('canvas');
      const MAX_SIZE = 1200;
      let width = mainCanvas.width;
      let height = mainCanvas.height;
      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }
      tempC.width = width;
      tempC.height = height;
      tempC.getContext('2d').drawImage(mainCanvas, 0, 0, width, height);
      
      const blob = await new Promise(r => tempC.toBlob(r, 'image/avif', 0.8));
      const filename = `drawings/${Date.now()}.avif`;
      
      // 1. Storage에 이미지 업로드
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob, { customMetadata: { likes: '0' } });
      const downloadURL = await getDownloadURL(storageRef);

      // 2. Firestore에 데이터 저장 (빠른 로딩을 위해)
      await addDoc(collection(db, "posts"), {
        storageRef: filename,
        url: downloadURL,
        name: filename.split('/')[1], // 파일명만
        createdAt: serverTimestamp(),
        likes: 0,
        adminComment: ''
      });

      await showAlert('저장 완료! 15분 이내에 삭제할 수 있습니다!');
      resetCanvas();
      
      // 갤러리 갱신은 Gallery 컴포넌트 내부 혹은 스토어 구독을 통해 처리됨
      window.location.reload(); // 간단하게 새로고침하여 반영 (또는 스토어 업데이트)

    } catch(e) {
      console.error(e);
      await showAlert('저장 실패');
    } finally {
      $isSaving = false;
    }
  }
</script>

<svelte:window on:pointerup={stopDrawing} on:pointercancel={stopDrawing}/>

<main>
  {#if !isMobile}
    <NowPlayingWidget />

    <div class="qr-banner">
      <div class="qr-text">
        갤러리에서 그림에<br>
        댓글을 달 수 있다!
      </div>
      <img src="/qrcode.jpg" alt="Gallery QR" />
    </div>
  {/if}

  <Screensaver 
    index={screensaverIndex} 
    on:stop={stopScreensaver} 
  />
  
  <ColorPicker />

  {#if selectedImage}
    <ImageModal 
      img={selectedImage} 
      on:close={() => selectedImage = null}
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
  />

  {#if $showBrushPreview}
    <div 
      class="brush-preview"
      style="
        width: {$size}px;
        height: {$size}px; 
        background-color: {$currentTool === 'eraser' ? '#ffffff' : $color};
        border: {$currentTool === 'eraser' ? '2px solid #333' : ($color === '#ffffff' ? '2px solid #eee' : 'none')};
      "
    ></div>
  {/if}
</main>

<style>
  :global(body) { margin: 0; padding: 0; overflow: hidden; }
  main { position: relative; width: 100vw; height: 100vh; background: white; }
  canvas { display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; touch-action: none; }
  .temp-canvas { z-index: 2; cursor: crosshair; }
  .main-canvas { z-index: 1; }

  .brush-preview {
    position: fixed;
    top: 50%; left: 50%; transform: translate(-50%, -50%);
    border-radius: 50%; pointer-events: none;
    z-index: 100; box-shadow: 0 0 10px rgba(0,0,0,0.1);
  }

  /* [추가] QR 배너 스타일 */
  .qr-banner {
    position: absolute;
    top: 10px;      /* 툴바 높이에 맞춰 조절하세요 */
    left: 50px;        /* 화면 왼쪽 여백 */
    display: flex;
    align-items: center;
    gap: 12px;
    background-color: rgba(255, 255, 255, 0.9);
    padding: 10px 15px;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    z-index: 9999;       /* 캔버스보다 위, 모달보다는 아래 */
    pointer-events: none; /* 그림 그리기 방해 방지 (이미지 클릭 필요시 auto로 변경) */
    backdrop-filter: blur(5px);
    transition: transform 0.3s ease;
  }
  
  /* 마우스 올렸을 때 살짝 떠오르는 효과 (선택사항) */
  .qr-banner:hover {
    transform: translateY(-5px);
    pointer-events: auto;
  }

  .qr-text {
    font-size: 14px;
    font-weight: 700;
    color: #333;
    line-height: 1.4;
    text-align: right;
    word-break: keep-all;
  }

  .qr-banner img {
    width: 60px;       /* QR 코드 크기 */
    height: 60px;
    border-radius: 8px;
    display: block;
  }
</style>