<script>
  import { onMount } from 'svelte';
  import SiteHeader from '../../components/SiteHeader.svelte';
  import { ApiError, apiRequest, asList, displayError, unwrap } from '../../lib/api.js';

  let institutes = [];
  let selectedInstitute = '';
  let accountName = '';
  let memberNumber = '';
  let phone = '';
  let timezone = 'UTC';
  let hasProfile = false;
  let institutesError = '';
  let loading = true;
  let saving = false;
  let errorMessage = '';
  let successMessage = '';

  function instituteId(institute) {
    return institute.id ?? institute.institute_id;
  }

  onMount(async () => {
    const [profileResult, instituteResult, accountResult] = await Promise.allSettled([
      apiRequest('/extended-users/me'),
      apiRequest('/institutes', { credentials: 'omit' }),
      apiRequest('/auth/me')
    ]);

    const account = accountResult.status === 'fulfilled'
      ? unwrap(accountResult.value, 'user')
      : null;
    accountName = account?.username || account?.name || account?.email || '';

    if (instituteResult.status === 'fulfilled') {
      institutes = asList(instituteResult.value);
    } else {
      institutesError = displayError(instituteResult.reason, 'Could not load institutes.');
    }

    if (profileResult.status === 'fulfilled') {
      const profile = unwrap(profileResult.value, 'user');
      hasProfile = true;
      accountName = profile.acc_name || accountName;
      selectedInstitute = profile.institute_id ? String(profile.institute_id) : '';
      memberNumber = profile.institute_member_number || '';
      phone = profile.phone || '';
      timezone = profile.timezone || 'UTC';
    } else {
      const profileError = profileResult.reason;
      const missingProfile = profileError instanceof ApiError
        && profileError.status === 404
        && /Extended user profile not found/i.test(profileError.message);

      if (!missingProfile) {
        errorMessage = displayError(profileError, 'Could not load your onboarding details.');
      } else if (accountResult.status === 'rejected') {
        errorMessage = displayError(accountResult.reason, 'Could not load your account details.');
      }
    }
    loading = false;
  });

  async function saveProfile(event) {
    event.preventDefault();
    saving = true;
    errorMessage = '';
    successMessage = '';

    try {
      await apiRequest('/extended-users/me', {
        method: hasProfile ? 'PATCH' : 'PUT',
        body: JSON.stringify({
          acc_name: accountName.trim(),
          institute_id: selectedInstitute,
          institute_member_number: memberNumber.trim() || null,
          phone: phone.trim() || null,
          timezone: timezone.trim()
        })
      });
      hasProfile = true;
      successMessage = 'Your learning profile has been saved.';
      sessionStorage.removeItem('eval-onboarding-pending');
    } catch (error) {
      errorMessage = displayError(error, 'Could not save your profile.');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Eval. | Set up your profile</title>
  <meta name="description" content="Create or update your academic profile." />
</svelte:head>

<SiteHeader />

<main class="page-shell onboarding-shell">
  <section class="onboarding-card" aria-labelledby="onboarding-title">
    <div class="onboarding-intro">
      <p class="eyebrow">{hasProfile ? 'YOUR PROFILE' : 'FIRST, THE DETAILS'}</p>
      <h1 class="page-title" id="onboarding-title">{hasProfile ? 'Your learning profile.' : 'A place to begin.'}</h1>
      <p class="page-copy">
        A few details help us place your work in the right academic community. You can come back and change them later.
      </p>
    </div>

    {#if loading}
      <p class="onboarding-status" role="status">Loading your profile…</p>
    {:else if errorMessage}
      <div class="onboarding-error-box" role="alert">
        <p>{errorMessage}</p>
        <a class="quiet-action" href="/home/">Continue to your space <span aria-hidden="true">→</span></a>
      </div>
    {:else}
      <form class="onboarding-form" onsubmit={saveProfile}>
        <label>
          <span>Name for your academic profile</span>
          <input
            bind:value={accountName}
            maxlength="255"
            required
            autocomplete="name"
            placeholder="Your name"
          />
        </label>

        <label>
          <span>University or institute <b>Required</b></span>
          <select bind:value={selectedInstitute} required>
            <option value="" disabled>Select your institute</option>
            {#each institutes as institute}
              <option value={String(instituteId(institute))}>
                {institute.institute_name || institute.name || institute.title || `Institute ${instituteId(institute)}`}
              </option>
            {/each}
          </select>
          {#if institutesError}
            <small class="field-error" role="alert">{institutesError}</small>
          {:else}
            <small>Not certain yet? Skip setup for now; you can return when you know.</small>
          {/if}
        </label>

        <label>
          <span>University UID {#if selectedInstitute}<b>Required</b>{:else}<em>Optional</em>{/if}</span>
          <input
            bind:value={memberNumber}
            maxlength="64"
            required={Boolean(selectedInstitute)}
            placeholder="University-issued UID"
          />
          <small>Enter the UID provided by your university or institute.</small>
        </label>

        <div class="onboarding-two-column">
          <label>
            <span>Phone <em>Optional</em></span>
            <input bind:value={phone} type="tel" maxlength="30" autocomplete="tel" placeholder="+1 555 000 0000" />
          </label>
          <label>
            <span>Time zone</span>
            <input bind:value={timezone} maxlength="64" required placeholder="UTC" />
            <small>For example, Europe/London or America/New_York.</small>
          </label>
        </div>

        {#if errorMessage}<p class="onboarding-error" role="alert">{errorMessage}</p>{/if}
        {#if successMessage}
          <p class="onboarding-success" role="status">{successMessage}</p>
        {/if}

        <div class="onboarding-actions">
          <a class="quiet-action" href="/home/" onclick={() => sessionStorage.removeItem('eval-onboarding-pending')}>
            Skip for now <span aria-hidden="true">→</span>
          </a>
          <button type="submit" class="primary-action" disabled={saving || !institutes.length}>
            {saving ? 'Saving…' : hasProfile ? 'Save profile' : 'Create profile'}
          </button>
        </div>
      </form>
    {/if}
  </section>
</main>
