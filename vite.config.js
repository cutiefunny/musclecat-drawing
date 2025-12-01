import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate', // 업데이트 시 자동 새로고침
			includeAssets: ['favicon.svg', 'robots.txt'], // 캐싱할 정적 파일
			manifest: {
				name: 'MuscleCat Drawing',
				short_name: '근육고양이 그림판',
				description: '간단하게 그림을 그리는 앱이다!',
				theme_color: '#ffffff',
				background_color: '#ffffff',
				display: 'standalone', // 브라우저 UI 없이 앱처럼 실행
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					}
				]
			}
		})
	]
});