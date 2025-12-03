<script>
  import { onMount } from 'svelte';
  import { storage, db } from '$lib/firebase'; // db 추가
  import { ref, listAll, getDownloadURL, deleteObject } from 'firebase/storage';
  import { doc, getDoc, setDoc } from 'firebase/firestore'; // Firestore 함수 추가
  import { showAlert, showConfirm } from '$lib/stores/dialog';

  let images = [];
  let isLoading = true;

  // [추가] 설정값 상태 관리 (기본값)
  let config = {
    idleTimeoutSec: 60, // 1분
    slideDurationSec: 5 // 5초
  };

  onMount(async () => {
    await loadSettings();
    loadImages();
  });

  // [추가] Firestore에서 설정 불러오기
  async function loadSettings() {
    try {
      const docRef = doc(db, "global", "settings");
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        config = docSnap.data();
      }
    } catch (e) {
      console.error("설정 로드 실패:", e);
    }
  }

  // [추가] 설정을 Firestore에 저장하기
  async function saveSettings() {
    try {
      const docRef = doc(db, "global", "settings");
      await setDoc(docRef, {
        idleTimeoutSec: Number(config.idleTimeoutSec),
        slideDurationSec: Number(config.slideDurationSec)
      });
      await showAlert('설정이 저장되었습니다! \n모든 기기에 즉시 반영됩니다.');
    } catch (e) {
      console.error(e);
      await showAlert('설정 저장 실패');
    }
  }

  async function loadImages() {
    isLoading = true;
    try {
      const listRef = ref(storage, 'drawings/');
      const res = await listAll(listRef);
      const promises = res.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          ref: itemRef,
          url: url,
          name: itemRef.name,
          time: parseInt(itemRef.name.split('.')[0]) 
        };
      });
      const result = await Promise.all(promises);
      images = result.sort((a, b) => b.time - a.time);
    } catch (error) {
      console.error("이미지 로드 실패:", error);
      await showAlert('목록을 불러오는데 실패했습니다.');
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete(image) {
    const isConfirmed = await showConfirm('정말 이 그림을 삭제하시겠습니까?\n복구할 수 없습니다.');
    if (!isConfirmed) return;

    try {
      await deleteObject(image.ref);
      images = images.filter(img => img.name !== image.name);
      await showAlert('삭제되었습니다.');
      
    } catch (error) {
      console.error("삭제 실패:", error);
      await showAlert('삭제에 실패했습니다.');
    }
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }
</script>

<main>
  <header>
    <h1>Admin Dashboard</h1>
    <a href="/" class="home-link">← 그림판으로 돌아가기</a>
  </header>

  <section class="settings-panel">
    <h2>⚙️ 키오스크 설정</h2>
    <div class="input-group">
      <label>
        대기 시간 (초)
        <input type="number" bind:value={config.idleTimeoutSec} min="5" />
        <span class="desc">이 시간 동안 입력이 없으면 스크린세이버 실행</span>
      </label>
      
      <label>
        슬라이드 속도 (초)
        <input type="number" bind:value={config.slideDurationSec} min="1" />
        <span class="desc">이미지가 넘어가는 간격</span>
      </label>
      
      <button class="save-btn" on:click={saveSettings}>설정 저장</button>
    </div>
  </section>

  {#if isLoading}
    <div class="loading">목록을 불러오는 중입니다...</div>
  {:else if images.length === 0}
    <div class="empty">저장된 그림이 없습니다.</div>
  {:else}
    <div class="grid">
      {#each images as img}
        <div class="card">
          <div class="image-wrapper">
            <img src={img.url} alt={img.name} loading="lazy" />
          </div>
          <div class="info">
            <span class="date">{formatDate(img.time)}</span>
            <button class="delete-btn" on:click={() => handleDelete(img)}>삭제</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: sans-serif;
    background-color: #f5f5f5;
  }

  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    border-bottom: 1px solid #ddd;
    padding-bottom: 20px;
  }

  h1 {
    margin: 0;
    font-size: 1.8rem;
    color: #333;
  }

  /* [추가] 설정 패널 스타일 */
  .settings-panel {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin-bottom: 30px;
  }
  .settings-panel h2 { margin-top: 0; font-size: 1.2rem; margin-bottom: 15px; }
  .input-group { display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-end; }
  label { display: flex; flex-direction: column; gap: 5px; font-weight: bold; font-size: 0.9rem; }
  input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 100px; font-size: 1rem; }
  .desc { font-size: 0.75rem; color: #888; font-weight: normal; }
  .save-btn { background: #3ECF8E; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
  .save-btn:hover { background: #34b27b; }

  .home-link {
    text-decoration: none;
    color: #007bff;
    font-weight: bold;
    padding: 8px 16px;
    border: 1px solid #007bff;
    border-radius: 4px;
    transition: all 0.2s;
  }
  .home-link:hover {
    background: #007bff;
    color: white;
  }

  .loading, .empty {
    text-align: center;
    padding: 50px;
    font-size: 1.2rem;
    color: #666;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
  }

  .card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: transform 0.2s;
    display: flex;
    flex-direction: column;
  }

  .card:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.15);
  }

  .image-wrapper {
    width: 100%;
    aspect-ratio: 1; 
    background: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .image-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .info {
    padding: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #eee;
  }

  .date {
    font-size: 0.8rem;
    color: #888;
  }

  .delete-btn {
    background: #ff4444;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.2s;
  }

  .delete-btn:hover {
    background: #cc0000;
  }
</style>