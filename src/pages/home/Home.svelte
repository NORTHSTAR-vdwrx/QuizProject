<script>
  import { onMount } from 'svelte';
  import SiteHeader from '../../components/SiteHeader.svelte';

  let username = '';
  let isLoading = true;
  let loadError = '';
  let role = '';

  onMount(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/me', {
        credentials: 'include'
      });

      if (!response.ok) {
        loadError = response.status === 401
          ? 'Please log in to view your home page.'
          : `Could not load your account (HTTP ${response.status}).`;
        return;
      }

      const result = await response.json();

      if (typeof result.username !== 'string') {
        throw new Error('The account response did not include a username.');
      }

      username = result.username;
      role = result.role;

      console.log(role);
    } catch (error) {
      console.warn('Could not load user details:', error);
      loadError = 'Unable to load your account. Please try again.';
    } finally {
      isLoading = false;
    }
  });
</script>

<svelte:head>
  <title>Eval. | Home</title>
</svelte:head>

<div class="landing-page">
  <SiteHeader />

  <main class="page-shell landing-hero">
    {#if isLoading}
      <p class="page-copy" role="status">Loading your account...</p>
    {:else if loadError}
      <div>
        <p class="page-copy" role="alert">{loadError}</p>
        <a href="/login/">Log in</a>
      </div>
    {:else}
      <h1 class="page-title home-page-greeting">
        <span style="font-weight: 100; font-family:'Montserrat'">WELCOME, </span><br>{username}!
      </h1>
      
      {#if role}
      {/if}
    
    {/if}
  </main>
</div>