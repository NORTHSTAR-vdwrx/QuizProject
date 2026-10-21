<script>
  export let mode = 'login';

  let username = '';
  let email = '';
  let password = '';
  let submitting = false;
  let message = '';
  let accountCreated = false;

  $: isLogin = mode === 'login';

  async function handleSubmit(event) {
    event.preventDefault();
    submitting = true;
    message = '';

    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/${isLogin ? 'login' : 'create'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(
            isLogin ? { username, password } : { username, email, password }
          )
        }
      );
      const result = await response.json();

      if (!response.ok) {
        if (typeof result.detail === 'string') {
          message = result.detail;
        } else if (Array.isArray(result.detail)) {
          message = result.detail.map((error) => error.msg).join(' ');
        } else {
          message = 'Could not complete your request. Please try again.';
        }
        return;
      }

      if (isLogin) {
        window.location.assign('/');
      } else {
        accountCreated = true;
      }
    } catch (error) {
      console.error('Authentication request failed:', error);
      message = 'Unable to reach the server. Check that the API is running and CORS is configured.';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Eval. | {isLogin ? 'Log in' : 'Create account'}</title>
  <meta
    name="description"
    content={isLogin ? 'Log in to your Eval. account.' : 'Create your Eval. account.'}
  />
</svelte:head>

<main class="auth-page">
  <section class="auth-card" aria-labelledby="auth-heading">
    <div class="auth-intro">
      <a class="auth-brand" href="/" aria-label="Eval. home">E.</a>
      <div class="auth-intro-copy">
        <h1 id="auth-heading">{isLogin ? 'Welcome back.' : 'Start learning.'}</h1>
      </div>
    </div>

    <div class="auth-form-panel">
      {#if accountCreated}
        <div class="auth-success" role="status">
          <h2>You're all set.</h2>
          <p>Your account was created. Log in to get started.</p>
          <a class="auth-button auth-button-link" href="/login/">Continue to log in</a>
        </div>
      {:else}
        <div class="auth-form-heading">
          <h2>{isLogin ? 'Log in' : 'Create your account'}</h2>
        </div>

        <form class="auth-form" onsubmit={handleSubmit}>
          <label>
            <span>Username</span>
            <input
              bind:value={username}
              name="username"
              autocomplete="username"
              required
            />
          </label>

          {#if !isLogin}
            <label>
              <span>Email</span>
              <input
                bind:value={email}
                type="email"
                name="email"
                autocomplete="email"
                required
              />
            </label>
          {/if}

          <label>
            <span>Password</span>
            <input
              bind:value={password}
              type="password"
              name="password"
              autocomplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {#if message}
            <p class="auth-message" role="alert">{message}</p>
          {/if}

          <button class="auth-button" type="submit" disabled={submitting}>
            {submitting
              ? 'Please wait...'
              : isLogin
                ? 'Log in'
                : 'Create account'}
          </button>
        </form>

        <p class="auth-switch">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}
          <a href={isLogin ? '/register/' : '/login/'}>
            {isLogin ? 'Create account' : 'Log in'}
          </a>
        </p>
      {/if}
    </div>
  </section>

  <footer class="auth-footer">
    <a href="/">Back to home</a>
  </footer>
</main>
