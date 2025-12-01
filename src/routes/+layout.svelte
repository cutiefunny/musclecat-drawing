<script>
  import Dialog from '$lib/components/Dialog.svelte';
  // 기존 코드 유지
  import favicon from '$lib/assets/favicon.svg';
  let { children } = $$props; // Svelte 5 문법 대응 (혹은 let { children } = $$props;)
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<Dialog />

<slot />