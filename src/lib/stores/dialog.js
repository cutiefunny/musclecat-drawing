// src/lib/stores/dialog.js
import { writable } from 'svelte/store';

const initialState = {
  isOpen: false,
  type: 'alert', // 'alert' 또는 'confirm'
  message: '',
  resolve: null // Promise의 resolve 함수 저장용
};

export const dialogStore = writable(initialState);

// Alert 호출 함수
export function showAlert(message) {
  return new Promise((resolve) => {
    dialogStore.set({
      isOpen: true,
      type: 'alert',
      message,
      resolve: (value) => resolve(value)
    });
  });
}

// Confirm 호출 함수
export function showConfirm(message) {
  return new Promise((resolve) => {
    dialogStore.set({
      isOpen: true,
      type: 'confirm',
      message,
      resolve: (value) => resolve(value)
    });
  });
}

// 다이얼로그 닫기 (내부용)
export function closeDialog(result) {
  dialogStore.update(state => {
    if (state.resolve) state.resolve(result); // await 하고 있는 곳에 결과 전달
    return { ...initialState };
  });
}