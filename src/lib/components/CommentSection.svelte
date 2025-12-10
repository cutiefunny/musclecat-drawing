<script>
  import { onMount, onDestroy } from 'svelte';
  import { db } from '$lib/firebase';
  // [수정] doc, deleteDoc, updateDoc 추가 임포트
  import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
  import { showAlert, showConfirm } from '$lib/stores/dialog';

  export let img; 
  export let scrollable = false; 

  let comments = [];
  let newComment = '';
  let isSubmitting = false;
  let unsubscribe;

  // [추가] 사용자 식별 및 수정 상태 관리
  let userId = '';
  let editingId = null; // 현재 수정 중인 댓글 ID
  let editText = '';    // 수정 중인 텍스트

  onMount(() => {
    // 1. 사용자 ID 로드 또는 생성 (브라우저 단위 식별)
    userId = localStorage.getItem('musclecat_uid');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('musclecat_uid', userId);
    }

    // 2. 댓글 구독
    const q = query(
      collection(db, "comments"),
      where("imageId", "==", img.name),
      orderBy("createdAt", "asc")
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
      comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  async function handleSubmit() {
    if (!newComment.trim() || isSubmitting) return;

    isSubmitting = true;
    try {
      await addDoc(collection(db, "comments"), {
        imageId: img.name,
        text: newComment,
        createdAt: serverTimestamp(),
        author: '냥이' + Math.floor(Math.random() * 1000),
        userId: userId // [추가] 본인 확인용 ID 저장
      });
      newComment = '';
    } catch (e) {
      console.error("댓글 실패:", e);
      showAlert("댓글 등록에 실패했어요.");
    } finally {
      isSubmitting = false;
    }
  }

  // [추가] 댓글 삭제 함수
  async function handleDelete(commentId) {
    if (!(await showConfirm("댓글을 삭제하시겠습니까?"))) return;
    
    try {
      await deleteDoc(doc(db, "comments", commentId));
    } catch (e) {
      console.error("삭제 실패:", e);
      showAlert("삭제하지 못했어요.");
    }
  }

  // [추가] 수정 모드 시작
  function startEdit(comment) {
    editingId = comment.id;
    editText = comment.text;
  }

  // [추가] 수정 취소
  function cancelEdit() {
    editingId = null;
    editText = '';
  }

  // [추가] 수정 완료 저장
  async function saveEdit(commentId) {
    if (!editText.trim()) return;

    try {
      await updateDoc(doc(db, "comments", commentId), {
        text: editText,
        isEdited: true // 수정됨 표시 (선택 사항)
      });
      editingId = null;
    } catch (e) {
      console.error("수정 실패:", e);
      showAlert("수정하지 못했어요.");
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
</script>

<div class="comment-section" class:scrollable>
  <div class="comment-list">
    {#if img.adminComment}
      <div class="comment-item admin">
        <span class="author">👑 근육고양이:</span>
        <span class="text">{img.adminComment}</span>
      </div>
    {/if}

    {#each comments as comment}
      <div class="comment-item" class:editing={editingId === comment.id}>
        <div class="comment-header">
          <div class="info-group">
            <span class="author">{comment.author}</span>
            <span class="date">
              {formatDate(comment.createdAt)}
              {#if comment.isEdited} <span class="edited">(수정됨)</span> {/if}
            </span>
          </div>

          {#if comment.userId === userId && editingId !== comment.id}
            <div class="btn-group">
              <button class="text-btn" on:click={() => startEdit(comment)}>수정</button>
              <span class="divider">|</span>
              <button class="text-btn delete" on:click={() => handleDelete(comment.id)}>삭제</button>
            </div>
          {/if}
        </div>

        {#if editingId === comment.id}
          <div class="edit-form">
            <input type="text" bind:value={editText} maxlength="50" />
            <div class="edit-actions">
              <button class="cancel-btn" on:click={cancelEdit}>취소</button>
              <button class="save-btn" on:click={() => saveEdit(comment.id)}>저장</button>
            </div>
          </div>
        {:else}
          <span class="text">{comment.text}</span>
        {/if}
      </div>
    {:else}
      {#if !img.adminComment}
        <div class="empty-msg">첫 댓글을 남겨보세요! 🐾</div>
      {/if}
    {/each}
  </div>

  <form class="input-area" on:submit|preventDefault={handleSubmit}>
    <input 
      type="text" 
      placeholder="댓글 달기..." 
      bind:value={newComment} 
      maxlength="50"
    />
    <button type="submit" disabled={!newComment.trim() || isSubmitting}>
      등록
    </button>
  </form>
</div>

<style>
  .comment-section {
    display: flex;
    flex-direction: column;
    background: #fff;
    width: 100%;
  }

  .comment-section.scrollable {
    height: 100%; 
    min-height: 300px;
  }
  .comment-section.scrollable .comment-list {
    overflow-y: auto;
  }

  .comment-list {
    flex: 1;
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .comment-item {
    font-size: 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f5f5f5;
  }
  .comment-item:last-child { border-bottom: none; }

  /* 수정 중일 때 배경 강조 */
  .comment-item.editing {
    background: #f9f9f9;
    padding: 8px;
    border-radius: 8px;
    border-bottom: none;
  }

  .comment-item.admin {
    background: #fff9c4;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #fbc02d;
  }

  .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: #888;
  }
  
  .info-group {
    display: flex; gap: 6px; align-items: center;
  }

  .author { font-weight: bold; color: #555; }
  .text { color: #333; word-break: break-all; line-height: 1.4; padding-left: 2px; }
  .edited { font-size: 0.7rem; color: #aaa; margin-left: 4px; }

  /* 수정/삭제 버튼 그룹 */
  .btn-group {
    display: flex; align-items: center; gap: 4px;
  }
  .text-btn {
    background: none; border: none; padding: 0;
    font-size: 0.75rem; color: #999; cursor: pointer;
  }
  .text-btn:hover { color: #333; text-decoration: underline; }
  .text-btn.delete:hover { color: #ff4d4d; }
  .divider { font-size: 0.7rem; color: #ddd; }

  /* 수정 폼 스타일 */
  .edit-form {
    display: flex; flex-direction: column; gap: 6px; margin-top: 4px;
  }
  .edit-form input {
    padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;
  }
  .edit-actions {
    display: flex; justify-content: flex-end; gap: 6px;
  }
  .cancel-btn, .save-btn {
    padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; border: none;
  }
  .cancel-btn { background: #eee; color: #555; }
  .save-btn { background: #333; color: white; }

  .empty-msg {
    text-align: center; color: #999; margin: 20px 0; font-size: 0.9rem;
  }

  .input-area {
    padding: 10px;
    border-top: 1px solid #eee;
    display: flex;
    gap: 8px;
    background: #fff;
  }
  
  .input-area input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 20px;
    outline: none;
    font-size: 0.9rem;
  }
  .input-area input:focus { border-color: #333; }

  .input-area button {
    background: #333;
    color: white;
    border: none;
    padding: 0 15px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: bold;
    cursor: pointer;
    white-space: nowrap;
  }
  .input-area button:disabled { background: #ccc; cursor: not-allowed; }
</style>