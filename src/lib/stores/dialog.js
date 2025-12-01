import { writable } from 'svelte/store';

const initialState = {
  isOpen: false,
  type: 'alert', // 'alert' | 'confirm' | 'loading'
  message: '',
  resolve: null
};

export const dialogStore = writable(initialState);

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

// [추가됨] 로딩 모달 표시 함수
export function showLoading(message) {
  dialogStore.set({
    isOpen: true,
    type: 'loading',
    message,
    resolve: null // 사용자 응답이 필요 없으므로 null
  });
}

export function closeDialog(result) {
  dialogStore.update(state => {
    if (state.resolve) state.resolve(result);
    return { ...initialState };
  });
}