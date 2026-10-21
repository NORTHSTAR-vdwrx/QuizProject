<script>
  import { onMount, tick } from 'svelte';

  let authState = 'checking';
  let mobileMenuOpen = false;
  let accountMenuOpen = false;
  let logoutMessage = '';
  let navigationElement;
  let accountMenuElement;

  function animateOpen(element) {
    const gsap = window.gsap;
    if (!gsap || !element) return;

    gsap.fromTo(
      element,
      { autoAlpha: 0, y: -8 },
      { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out', clearProps: 'transform,opacity,visibility' }
    );
  }

  async function toggleMobileMenu() {
    if (mobileMenuOpen) {
      if (window.gsap && navigationElement) {
        await new Promise((resolve) => {
          window.gsap.to(navigationElement, {
            autoAlpha: 0,
            y: -8,
            duration: 0.15,
            ease: 'power2.in',
            onComplete: resolve
          });
        });
      }
      mobileMenuOpen = false;
      return;
    }

    mobileMenuOpen = true;
    await tick();
    animateOpen(navigationElement);
  }

  async function openAccountMenu() {
    if (accountMenuOpen) return;
    accountMenuOpen = true;
    await tick();
    animateOpen(accountMenuElement);
  }

  function closeAccountMenuOutside(event) {
    if (!event.target.closest('.account-menu-container')) {
      accountMenuOpen = false;
    }
  }

  function closeMenus(event) {
    if (event.key === 'Escape') {
      accountMenuOpen = false;
      if (mobileMenuOpen) toggleMobileMenu();
    }
  }

  async function logout() {
    logoutMessage = '';
    try {
      const response = await fetch('http://localhost:5000/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}`);
      }

      window.location.assign('/');
    } catch (error) {
      console.error('Unable to log out:', error);
      logoutMessage = 'Could not log out. Please try again.';
    }
  }

  onMount(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/me', {
        credentials: 'include'
      });

      if (response.status === 401) {
        authState = 'signed-out';
        return;
      }

      if (!response.ok) {
        throw new Error(`Sign-in check failed with status ${response.status}`);
      }

      authState = 'signed-in';
    } catch (error) {
      console.error('Unable to check sign-in status:', error);
      authState = 'error';
    }
  });
</script>

<svelte:window onkeydown={closeMenus} />
<svelte:document onpointerdown={closeAccountMenuOutside} />

<header class="header">
  <a class="title" href="/">Eval.</a>
  <button
    class="menu-toggle"
    type="button"
    aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
    aria-expanded={mobileMenuOpen}
    aria-controls="site-navigation"
    onclick={toggleMobileMenu}
  >
    <span></span>
    <span></span>
    <span></span>
  </button>
  <nav
    class:menu-open={mobileMenuOpen}
    class="site-nav"
    id="site-navigation"
    aria-label="Main navigation"
    bind:this={navigationElement}
  >
    {#if authState === 'signed-in'}
      <a href="/home/" onclick={() => (mobileMenuOpen = false)}>Home</a>
      <a href="/quiz/" onclick={() => (mobileMenuOpen = false)}>Quiz</a>
      <a href="/results/" onclick={() => (mobileMenuOpen = false)}>Results</a>
      <div
        class="account-menu-container"
        role="group"
        aria-label="Account options"
        onmouseenter={openAccountMenu}
        onfocusout={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) accountMenuOpen = false;
        }}
      >
        <button
          class="account-trigger"
          type="button"
          aria-label="Account menu"
          aria-expanded={accountMenuOpen}
          aria-haspopup="true"
          onclick={openAccountMenu}
        >
          <img
            class="header-account-icon"
            src="https://media.istockphoto.com/id/2151669184/vector/vector-flat-illustration-in-grayscale-avatar-user-profile-person-icon-gender-neutral.jpg"
            alt=""
          />
        </button>
        {#if accountMenuOpen}
          <div class="account-dropdown" bind:this={accountMenuElement}>
            {#if logoutMessage}
              <p role="alert">{logoutMessage}</p>
            {/if}
            <button type="button" onclick={logout}>Log out</button>
          </div>
        {/if}
      </div>
    {:else if authState === 'checking'}
      <span role="status">Checking sign-in...</span>
    {:else}
      <a href="/login/" onclick={() => (mobileMenuOpen = false)}>Log In</a>
      <a href="/register/" onclick={() => (mobileMenuOpen = false)}>Register</a>
      {#if authState === 'error'}
        <span role="alert">Could not check sign-in status.</span>
      {/if}
    {/if}
  </nav>
</header>