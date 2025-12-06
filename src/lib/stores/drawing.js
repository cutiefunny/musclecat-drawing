import { writable } from 'svelte/store';

export const currentTool = writable('pen');
export const color = writable('#000000');
export const lastColor = writable('#000000');
export const size = writable(8);
export const isPenMode = writable(true); // [수정] 기본값을 true(펜 모드)로 변경
export const isColorPickerOpen = writable(false);
export const showBrushPreview = writable(false);
export const isScreensaverOn = writable(false);

// [추가됨] 저장 중 상태 관리 변수
export const isSaving = writable(false);