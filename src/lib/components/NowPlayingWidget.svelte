<script>
  import { fade, slide } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';
  import { db } from '$lib/firebase';
  import { doc, onSnapshot, collection, query, orderBy, setDoc } from 'firebase/firestore';

  let currentSong = null;
  let playlist = [];
  let isOpen = false; 
  let audioRef; 

  // [신규] 비활동 감지 타이머 변수
  let inactivityTimer;
  const INACTIVITY_LIMIT = 60000; // 1분 (60,000ms)

  onMount(() => {
    const nowPlayingRef = doc(db, "libraries", "branch2", "status", "nowPlaying");
    const unsubNowPlaying = onSnapshot(nowPlayingRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        currentSong = data?.currentSong || null;
      } else {
        currentSong = null;
      }
    });

    const songsRef = collection(db, 'libraries', 'branch2', 'songs');
    const q = query(songsRef, orderBy('order', 'asc'));
    const unsubPlaylist = onSnapshot(q, (snapshot) => {
      playlist = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title || '제목 없음',
        artist: doc.data().artist || 'Unknown',
        src: doc.data().src,
        order: doc.data().order
      }));
    });

    return () => {
      unsubNowPlaying();
      unsubPlaylist();
      clearTimeout(inactivityTimer); // 컴포넌트 해제 시 타이머 정리
    };
  });

  // [신규] isOpen 상태가 변할 때마다 타이머 관리
  $: if (isOpen) {
    resetInactivityTimer();
  } else {
    clearTimeout(inactivityTimer);
  }

  // [신규] 타이머 리셋 함수 (스크롤 등 활동 감지 시 호출)
  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (isOpen) {
      inactivityTimer = setTimeout(() => {
        isOpen = false; // 1분 뒤 닫기
      }, INACTIVITY_LIMIT);
    }
  }

  async function selectSong(song) {
    try {
      const commandRef = doc(db, "libraries", "branch2", "status", "commands");
      await setDoc(commandRef, {
        type: 'playSong',
        payload: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          src: song.src
        },
        timestamp: Date.now()
      });
      console.log("명령 전송 완료: ", song.title);
      
      // [수정] 곡 선택 시 목록 즉시 닫기
      isOpen = false;

    } catch (e) {
      console.error("명령 전송 실패:", e);
    }
  }

  function togglePlaylist() {
    isOpen = !isOpen;
  }
</script>

<div class="widget-wrapper">
  {#if currentSong}
    <div 
      class="now-playing-widget" 
      class:active={isOpen}
      transition:fade 
      on:click={togglePlaylist}
    >
      <span class="music-icon">🎵</span>
      <div class="music-info">
        <span class="now-playing-label">Now Playing</span>
        <span class="song-text">{currentSong.artist} - {currentSong.title}</span>
      </div>
      <span class="toggle-icon">{isOpen ? '▲' : '▼'}</span>
    </div>
  {/if}

  {#if isOpen && playlist.length > 0}
    <div 
      class="playlist-container" 
      transition:slide={{ duration: 300 }}
      on:scroll={resetInactivityTimer}
      on:mousemove={resetInactivityTimer}
    >
      <ul class="playlist">
        {#each playlist as song}
          <li 
            class="song-item" 
            class:playing={currentSong?.src === song.src}
            on:click={() => selectSong(song)}
          >
            <div class="song-details">
              <span class="song-title">{song.title}</span>
              <span class="song-artist">{song.artist}</span>
            </div>
            {#if currentSong?.src === song.src}
               <span class="playing-indicator">Eq</span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

{#if currentSong?.src}
  <audio 
    src={currentSong.src} 
    bind:this={audioRef} 
    autoplay 
    hidden
  ></audio>
{/if}

<style>
  .widget-wrapper {
    position: fixed;
    top: 10px;
    right: 200px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    z-index: 10002;
    pointer-events: none;
  }

  .now-playing-widget {
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    padding: 10px 20px;
    border-radius: 25px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    gap: 12px;
    color: white;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: background 0.2s, transform 0.2s;
    min-width: 200px;
    justify-content: space-between;
  }

  .now-playing-widget:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.02);
  }
  
  .now-playing-widget.active {
    border-radius: 20px 20px 5px 5px;
    border-bottom: none;
    background: rgba(0, 0, 0, 0.85);
  }

  .music-icon {
    font-size: 1.2rem;
    animation: bounce-music 2s infinite;
  }
  
  .toggle-icon {
    font-size: 0.8rem;
    color: #aaa;
    margin-left: 8px;
  }

  .music-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 1;
    overflow: hidden;
  }

  .now-playing-label {
    font-size: 0.65rem;
    color: #ccc;
    text-transform: uppercase;
    font-weight: bold;
    margin-bottom: 2px;
  }

  .song-text {
    font-size: 0.95rem;
    font-weight: bold;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    max-width: 200px;
  }

  .playlist-container {
    pointer-events: auto;
    width: 100%;
    min-width: 260px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-top: none;
    border-radius: 5px 5px 20px 20px;
    overflow: hidden;
    margin-top: -1px;
    box-shadow: 0 10px 20px rgba(0,0,0,0.4);
  }

  .playlist {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 400px;
    overflow-y: auto;
  }

  .playlist::-webkit-scrollbar {
    width: 6px;
  }
  .playlist::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.3);
    border-radius: 3px;
  }

  .song-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: background 0.2s;
  }

  .song-item:last-child {
    border-bottom: none;
  }

  .song-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .song-item.playing {
    background: rgba(255, 215, 0, 0.15);
    color: #FFD700;
  }

  .song-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .song-title {
    font-size: 0.9rem;
    font-weight: bold;
    color: white;
  }
  .song-item.playing .song-title { color: #FFD700; }

  .song-artist {
    font-size: 0.75rem;
    color: #bbb;
  }
  .song-item.playing .song-artist { color: #ffe066; }

  .playing-indicator {
    font-size: 0.7rem;
    color: #FFD700;
    font-weight: bold;
    border: 1px solid #FFD700;
    padding: 2px 4px;
    border-radius: 4px;
  }

  @keyframes bounce-music {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
</style>