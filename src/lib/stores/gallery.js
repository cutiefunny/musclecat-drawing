import { writable } from 'svelte/store';

export const savedDrawings = writable([]);
export const isGalleryLoading = writable(false);
export const isGalleryEnd = writable(false);
export const cooldownSet = writable(new Set()); // 좋아요 쿨타임 관리