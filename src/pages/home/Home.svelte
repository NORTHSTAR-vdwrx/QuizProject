<script>
  import { onMount, tick } from 'svelte';
  import SiteHeader from '../../components/SiteHeader.svelte';
  import TeacherWorkspace from './TeacherWorkspace.svelte';
  import { apiRequest, asList, displayError, unwrap } from '../../lib/api.js';

  let user = null;
  let role = '';
  let sessions = [];
  let performance = null;
  let performanceError = '';
  let quizzes = [];
  let quizSearch = '';
  let institutes = [];
  let adminUsers = [];
  let userSearch = '';
  let userRoleFilter = 'all';
  let accountDialog = '';
  let accountLoading = false;
  let accountSaving = false;
  let accountError = '';
  let accountMessage = '';
  let editingUserId = '';
  let selectedAccount = null;
  let accountUsername = '';
  let accountEmail = '';
  let accountPassword = '';
  let accountRole = 'student';
  let profileExists = false;
  let profileName = '';
  let profileInstituteId = '';
  let profileMemberNumber = '';
  let profilePhone = '';
  let profileTimezone = 'UTC';
  let dialogElement;
  let isLoading = true;
  let pageError = '';
  let resourceError = '';
  let instituteName = '';
  let creatingInstitute = false;
  let instituteMessage = '';
  let instituteError = '';

  const roleLabels = {
    student: 'Student space',
    teacher: 'Teacher space',
    administrator: 'Administration'
  };
  $: filteredAdminUsers = adminUsers.filter((account) => {
    const query = userSearch.trim().toLowerCase();
    const matchesQuery = !query || [
      account.name,
      account.username,
      account.email,
      account.id,
      account.user_id,
      account.extended_profile?.institute_member_number,
      account.extended_user?.institute_member_number,
      account.institute_member_number
    ].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesQuery && (userRoleFilter === 'all' || account.role === userRoleFilter);
  });
  $: isOwnAccount = Boolean(
    user
    && editingUserId
    && userId(user)
    && String(userId(user)).toLowerCase() === String(editingUserId).toLowerCase()
  );
  $: accountCountLabel = `${adminUsers.length} ${adminUsers.length === 1 ? 'account' : 'accounts'}`;
  $: filteredAdminQuizzes = quizzes.filter((quiz) => {
    const query = quizSearch.trim().toLowerCase();
    return !query || [
      quiz.title,
      quiz.teacher_id,
      quiz.id
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });
  $: scoreTrendPoints = (performance?.score_trend || []).map((point, index, list) => ({
    ...point,
    x: list.length === 1 ? 400 : 12 + index * (776 / (list.length - 1)),
    y: 180 - Math.min(100, Math.max(0, Number(point.score_percent) || 0)) * 1.65
  }));
  $: scoreTrendLine = scoreTrendPoints.map((point) => `${point.x},${point.y}`).join(' ');

  onMount(loadDashboard);

  async function loadDashboard() {
    try {
      user = unwrap(await apiRequest('/auth/me'), 'user');
      role = user.role || 'student';
    } catch (error) {
      pageError = displayError(error, 'Unable to load your account.');
      isLoading = false;
      return;
    }

    const jobs = [];
    if (role === 'student' || role === 'administrator') {
      jobs.push(apiRequest('/sessions').then((result) => (sessions = asList(result))));
    }
    if (role === 'student') {
      jobs.push(apiRequest('/students/me/performance?days=365')
        .then((result) => (performance = unwrap(result, 'analytics')))
        .catch((error) => (performanceError = displayError(error, 'Could not load your performance summary.'))));
    }
    if (role === 'administrator') {
      jobs.push(apiRequest('/quizzes').then((result) => (quizzes = asList(result))));
      jobs.push(apiRequest('/institutes', { credentials: 'omit' }).then((result) => (institutes = asList(result))));
      jobs.push(loadAdminUsers());
    }

    const results = await Promise.allSettled(jobs);
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length) {
      resourceError = failed.map((result) => displayError(result.reason, 'A dashboard section could not be loaded.')).join(' ');
    }
    isLoading = false;
    await animateDashboard();
  }

  async function animateDashboard() {
    await tick();
    const gsap = window.gsap;
    if (!gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const shell = document.querySelector('.dashboard-shell');
    const sections = shell?.querySelectorAll('.dashboard-heading, .dashboard-section');
    if (!sections?.length) return;
    gsap.fromTo(sections, { autoAlpha: 0, y: 10 }, {
      autoAlpha: 1,
      y: 0,
      duration: 0.38,
      stagger: 0.07,
      ease: 'power2.out',
      clearProps: 'transform,opacity,visibility'
    });
  }

  async function animateDialog() {
    await tick();
    const gsap = window.gsap;
    if (!gsap || !dialogElement || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const backdrop = dialogElement.parentElement;
    const timeline = gsap.timeline();
    timeline.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.16, ease: 'power1.out' });
    timeline.fromTo(dialogElement, { autoAlpha: 0, y: 9 }, {
      autoAlpha: 1,
      y: 0,
      duration: 0.24,
      ease: 'power2.out',
      clearProps: 'transform,opacity,visibility'
    }, '-=0.07');
    dialogElement.querySelector('input, select, button:not(.dialog-close)')?.focus();
  }

  async function loadAdminUsers() {
    const result = await apiRequest('/admin/users');
    adminUsers = asList(result);
  }

  async function createInstitute(event) {
    event.preventDefault();
    creatingInstitute = true;
    instituteMessage = '';
    instituteError = '';

    try {
      const createdResult = await apiRequest('/institutes', {
        method: 'POST',
        body: JSON.stringify({ institute_name: instituteName.trim() })
      });
      const created = unwrap(createdResult, 'institute');
      institutes = [...institutes, created].sort((left, right) =>
        String(left.institute_name || '').localeCompare(String(right.institute_name || ''))
      );
      instituteName = '';
      instituteMessage = 'Institute created.';
    } catch (error) {
      instituteError = displayError(error, 'Could not create the institute.');
    } finally {
      creatingInstitute = false;
    }
  }

  function resetAccountEditor() {
    accountDialog = '';
    accountLoading = false;
    accountSaving = false;
    accountError = '';
    accountMessage = '';
    editingUserId = '';
    selectedAccount = null;
    accountUsername = '';
    accountEmail = '';
    accountPassword = '';
    accountRole = 'student';
    profileExists = false;
    profileName = '';
    profileInstituteId = '';
    profileMemberNumber = '';
    profilePhone = '';
    profileTimezone = 'UTC';
  }

  async function closeAccountManager() {
    if (!accountDialog) return;
    const gsap = window.gsap;
    if (gsap && dialogElement && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const backdrop = dialogElement.parentElement;
      await new Promise((resolve) => {
        gsap.to(backdrop, {
          autoAlpha: 0,
          duration: 0.15,
          ease: 'power1.in',
          onComplete: resolve
        });
      });
    }
    resetAccountEditor();
  }

  async function openCreateAccount() {
    resetAccountEditor();
    accountDialog = 'create';
    await animateDialog();
  }

  async function openAccountEditor(account) {
    resetAccountEditor();
    accountDialog = 'edit';
    editingUserId = String(userId(account));
    accountLoading = true;
    selectedAccount = account;
    await animateDialog();

    try {
      const result = await apiRequest(`/admin/users/${encodeURIComponent(editingUserId)}`);
      selectedAccount = result.user ?? result.account ?? result.data?.user ?? result.data?.account ?? result.data ?? result;
      const profile = profileOf(selectedAccount);
      accountUsername = selectedAccount.username || '';
      accountEmail = selectedAccount.email || '';
      accountRole = selectedAccount.role || 'student';
      profileExists = Boolean(
        selectedAccount.extended_profile
        || selectedAccount.extended_profile_details
        || selectedAccount.extended_user_profile
        || selectedAccount.extended_user
        || selectedAccount.profile
        || selectedAccount.acc_name
        || selectedAccount.display_name
        || selectedAccount.institute_id
        || selectedAccount.institute_member_number
      );
      profileName = profile.acc_name || profile.display_name || selectedAccount.name || '';
      const instituteId = profile.institute_id || profile.institute?.institute_id || profile.institute?.id;
      profileInstituteId = instituteId ? String(instituteId) : '';
      profileMemberNumber = profile.institute_member_number || '';
      profilePhone = profile.phone || '';
      profileTimezone = profile.timezone || 'UTC';
    } catch (error) {
      selectedAccount = null;
      accountError = displayError(error, 'Could not load this account.');
    } finally {
      accountLoading = false;
      await tick();
      dialogElement?.querySelector('input, select, button:not(.dialog-close)')?.focus();
    }
  }

  async function createAccount(event) {
    event.preventDefault();
    accountSaving = true;
    accountError = '';
    accountMessage = '';

    try {
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: accountUsername.trim(),
          email: accountEmail.trim(),
          password: accountPassword,
          role: accountRole
        })
      });
      try {
        await loadAdminUsers();
      } catch (error) {
        resourceError = `Account was created, but the directory could not refresh: ${displayError(error, 'Reload the page to see it.')}`;
      }
      await closeAccountManager();
    } catch (error) {
      accountError = displayError(error, 'Could not create this account.');
    } finally {
      accountSaving = false;
    }
  }

  async function saveAccount(event) {
    event.preventDefault();
    if (!editingUserId) return;
    if (isOwnAccount && accountRole !== user.role) {
      accountError = 'You cannot change your own administrator role.';
      return;
    }
    accountSaving = true;
    accountError = '';
    accountMessage = '';

    try {
      const result = await apiRequest(`/admin/users/${encodeURIComponent(editingUserId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          username: accountUsername.trim(),
          email: accountEmail.trim(),
          role: accountRole
        })
      });
      selectedAccount = result.user ?? result.account ?? result.data?.user ?? result.data ?? result;
      accountMessage = 'Account details saved.';
      try {
        await loadAdminUsers();
      } catch (error) {
        resourceError = `Account details were saved, but the directory could not refresh: ${displayError(error, 'Reload the page to see the changes.')}`;
      }
    } catch (error) {
      accountError = displayError(error, 'Could not update this account.');
    } finally {
      accountSaving = false;
    }
  }

  async function saveAccountProfile(event) {
    event.preventDefault();
    if (!editingUserId) return;
    accountSaving = true;
    accountError = '';
    accountMessage = '';

    const body = {
      acc_name: profileName.trim(),
      institute_member_number: profileMemberNumber.trim() || null,
      phone: profilePhone.trim() || null,
      timezone: profileTimezone.trim()
    };
    if (profileInstituteId) body.institute_id = profileInstituteId;

    try {
      await apiRequest(`/admin/users/${encodeURIComponent(editingUserId)}`, {
        method: profileExists ? 'PATCH' : 'PUT',
        body: JSON.stringify(body)
      });
      profileExists = true;
      accountMessage = 'Academic profile saved.';
      try {
        await loadAdminUsers();
      } catch (error) {
        resourceError = `Profile was saved, but the directory could not refresh: ${displayError(error, 'Reload the page to see the changes.')}`;
      }
    } catch (error) {
      accountError = displayError(error, 'Could not update this profile.');
    } finally {
      accountSaving = false;
    }
  }

  async function deleteAccount() {
    if (!editingUserId || isOwnAccount) return;
    accountSaving = true;
    accountError = '';
    try {
      await apiRequest(`/admin/users/${encodeURIComponent(editingUserId)}`, {
        method: 'DELETE'
      });
      adminUsers = adminUsers.filter((account) => String(userId(account)) !== editingUserId);
      await closeAccountManager();
    } catch (error) {
      accountError = displayError(error, 'Could not delete this account.');
      accountSaving = false;
    }
  }

  function closeAccountDialog(event) {
    if (event.key === 'Escape' && accountDialog) closeAccountManager();
  }

  function idOf(item) {
    return item.id ?? item.session_id;
  }

  function sessionTitle(session) {
    return session.title || session.quiz_title || session.name || session.quiz?.title || `Scheduled exam ${idOf(session)}`;
  }

  function userId(account) {
    return account.user_id || account.id;
  }

  function profileOf(account) {
    return account.extended_profile
      || account.extended_profile_details
      || account.extended_user_profile
      || account.extended_user
      || account.profile
      || account;
  }

  function dateLabel(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }
</script>

<svelte:head>
  <title>Eval. | Your space</title>
  <meta name="description" content="Your learning and assessment dashboard." />
</svelte:head>

<SiteHeader />

<main class="page-shell dashboard-shell">
  {#if isLoading}
    <p class="page-copy" role="status">Preparing your space…</p>
  {:else if pageError}
    <section class="dashboard-error" role="alert">
      <p>{pageError}</p>
      <a class="dashboard-button" href="/login/">Log in</a>
    </section>
  {:else}
    <header class="dashboard-heading">
      <div>
        {#if role !== 'administrator'}<p class="eyebrow">{roleLabels[role] || 'Eval. workspace'}</p>{/if}
        <h1 class="page-title">Hello, {user.username || user.name || 'there'}.</h1>
        <p class="page-copy">A clear view of what needs your attention, and what can wait.</p>
      </div>
      <a class="dashboard-secondary" href="/onboarding/">Edit learning profile</a>
    </header>

    {#if resourceError}<p class="dashboard-notice" role="alert">{resourceError}</p>{/if}

    {#if role === 'student'}
      <section class="dashboard-section" aria-labelledby="student-next">
        <div class="section-heading">
          <div>
            <p class="eyebrow">YOUR WORK</p>
            <h2 id="student-next">Upcoming assessments</h2>
          </div>
          <a class="text-link" href="/results/">View my attempts <span aria-hidden="true">→</span></a>
        </div>
        {#if sessions.length}
          <div class="dashboard-grid">
            {#each sessions as session (idOf(session))}
              <article class="dashboard-card">
                <span class="card-kicker">{session.status || 'Scheduled'}</span>
                <h3>{sessionTitle(session)}</h3>
                <p>{session.starts_at || session.start_time || session.scheduled_at || 'Ready when you are'}</p>
                <a class="dashboard-button" href={`/quiz/?session_id=${encodeURIComponent(idOf(session))}`}>
                  Open assessment <span aria-hidden="true">→</span>
                </a>
              </article>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <h3>Nothing scheduled just yet.</h3>
            <p>Your teacher’s assessments will appear here. You can set up your institute now, or come back later.</p>
            <a class="text-link" href="/onboarding/">Set up your learning profile <span aria-hidden="true">→</span></a>
          </div>
        {/if}
      </section>
      <section class="dashboard-section student-performance" aria-labelledby="student-performance-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">YOUR PROGRESS</p>
            <h2 id="student-performance-title">Performance</h2>
          </div>
          <span class="performance-period">Past year</span>
        </div>
        {#if performanceError}
          <p class="dashboard-notice" role="alert">{performanceError}</p>
        {:else if performance}
          <div class="performance-summary">
            <article><span>Average score</span><strong>{performance.summary.average_score_percent == null ? '—' : `${Math.round(performance.summary.average_score_percent)}%`}</strong></article>
            <article><span>Graded attempts</span><strong>{performance.summary.graded_attempts}</strong></article>
            <article><span>Awaiting grading</span><strong>{performance.summary.pending_grading_attempts}</strong></article>
            <article><span>Average completion</span><strong>{performance.summary.average_duration_seconds == null ? '—' : `${Math.round(performance.summary.average_duration_seconds / 60)} min`}</strong></article>
          </div>
          <div class="performance-chart-panel">
            <div class="performance-chart-heading">
              <div><h3>Score trend</h3><p>Scores from fully graded attempts</p></div>
              {#if performance.summary.latest_score_percent != null}<strong>Latest {Math.round(performance.summary.latest_score_percent)}%</strong>{/if}
            </div>
            {#if scoreTrendPoints.length}
              <svg class="performance-chart" viewBox="0 0 800 200" role="img" aria-label="Score trend chart">
                <line x1="12" y1="15" x2="788" y2="15" />
                <line x1="12" y1="97.5" x2="788" y2="97.5" />
                <line x1="12" y1="180" x2="788" y2="180" />
                <text x="0" y="12">100</text><text x="0" y="94">50</text><text x="4" y="177">0</text>
                {#if scoreTrendPoints.length > 1}<polyline points={scoreTrendLine} />{/if}
                {#each scoreTrendPoints as point (point.attempt_id)}
                  <circle cx={point.x} cy={point.y} r="4"><title>{point.quiz_title}: {Math.round(point.score_percent)}%</title></circle>
                {/each}
              </svg>
              <div class="performance-chart-labels">
                <span>{dateLabel(scoreTrendPoints[0].submitted_at)}</span>
                <span>{dateLabel(scoreTrendPoints[scoreTrendPoints.length - 1].submitted_at)}</span>
              </div>
            {:else}
              <p class="performance-empty">Graded quiz results will appear here after your first completed assessment.</p>
            {/if}
          </div>
          {#if performance.quiz_performance?.length}
            <div class="performance-quiz-list">
              <h3>By quiz</h3>
              {#each performance.quiz_performance.slice(0, 5) as item (item.quiz_id)}
                <div class="performance-quiz-row">
                  <span><strong>{item.quiz_title}</strong><small>{item.attempt_count} graded attempt{item.attempt_count === 1 ? '' : 's'}</small></span>
                  <div class="performance-quiz-bar" role="img" aria-label={`${Math.round(item.latest_score_percent)} percent latest score`}><span style={`width: ${Math.max(0, Math.min(100, item.latest_score_percent))}%`}></span></div>
                  <strong>{Math.round(item.latest_score_percent)}%</strong>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </section>
    {:else if role === 'teacher'}
      <TeacherWorkspace />
    {:else if role === 'administrator'}
      <section class="dashboard-section" aria-labelledby="admin-tools">
        <div class="section-heading">
          <div>
            <h2 id="admin-tools">Manage your learning community</h2>
          </div>
          <button class="dashboard-button" type="button" onclick={openCreateAccount}>Create account <span aria-hidden="true">+</span></button>
        </div>
        <div class="dashboard-grid admin-grid">
          <article class="dashboard-card">
            <h3>Create an institute</h3>
            <form class="admin-form" onsubmit={createInstitute}>
              <label>
                <span>University name</span>
                <input bind:value={instituteName} required maxlength="120" placeholder="e.g. Northstar University" />
              </label>
              {#if instituteError}<p class="dashboard-form-error" role="alert">{instituteError}</p>{/if}
              {#if instituteMessage}<p class="dashboard-form-success" role="status">{instituteMessage}</p>{/if}
              <button class="dashboard-button" type="submit" disabled={creatingInstitute || !instituteName.trim()}>
                {creatingInstitute ? 'Creating…' : 'Create institute'}
              </button>
            </form>
          </article>
          <article class="dashboard-card institute-directory-card">
            <h3>Universities and institutes</h3>
            <p>{institutes.length ? `${institutes.length} available` : 'No institutes have been added yet.'}</p>
            {#if institutes.length}
              <ul class="institute-directory-list">
                {#each institutes as institute (institute.id ?? institute.institute_id)}
                  <li>
                    <span>{institute.institute_name || institute.name || institute.title || `Institute ${institute.id ?? institute.institute_id}`}</span>
                    <code>{institute.id ?? institute.institute_id}</code>
                  </li>
                {/each}
              </ul>
            {/if}
          </article>
          <article class="dashboard-card">
            <h3>Account directory</h3>
            <p>{accountCountLabel} across the learning community.</p>
            <button class="dashboard-button dashboard-button-muted" type="button" onclick={() => document.getElementById('account-directory-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Browse accounts <span aria-hidden="true">↓</span>
            </button>
          </article>
          <article class="dashboard-card">
            <h3>Quiz oversight</h3>
            <p>{quizzes.length} quizzes across all accounts.</p>
            <p>{sessions.length} scheduled sessions.</p>
            <button class="dashboard-button dashboard-button-muted" type="button" onclick={() => document.getElementById('admin-quiz-library-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Browse quizzes <span aria-hidden="true">↓</span>
            </button>
          </article>
        </div>
      </section>
      <section class="dashboard-section admin-quiz-library" aria-labelledby="admin-quiz-library-title">
        <div class="section-heading">
          <div>
            <h2 id="admin-quiz-library-title">Quiz library <span class="directory-count">{quizzes.length}</span></h2>
            <p class="page-copy">Quizzes created across the learning community.</p>
          </div>
          <label class="directory-search">
            <span class="visually-hidden">Search quizzes</span>
            <input bind:value={quizSearch} type="search" placeholder="Search title or account ID" />
          </label>
        </div>
        {#if filteredAdminQuizzes.length}
          <div class="admin-quiz-list">
            <div class="admin-quiz-list-header" aria-hidden="true">
              <span>Quiz</span><span>Teacher account</span><span>Duration</span><span>Groups</span><span>Created</span>
            </div>
            {#each filteredAdminQuizzes as quiz (quiz.id)}
              <article class="admin-quiz-row">
                <div class="admin-quiz-title"><span class="admin-quiz-icon" aria-hidden="true">Q</span><div><h3>{quiz.title || 'Untitled quiz'}</h3><small>{quiz.id}</small></div></div>
                <code>{quiz.teacher_id || '—'}</code>
                <span>{quiz.duration_minutes} min</span>
                <span>{quiz.group_ids?.length || 0}</span>
                <time datetime={quiz.created_at}>{dateLabel(quiz.created_at)}</time>
              </article>
            {/each}
          </div>
        {:else if quizSearch.trim()}
          <div class="empty-state"><h3>No quizzes match that search.</h3><p>Search by quiz title or teacher account ID.</p></div>
        {:else}
          <div class="empty-state">
            <h3>{quizzes.length ? 'No matching quizzes.' : 'No quizzes have been created yet.'}</h3>
            <p>{quizzes.length ? 'Try another title or account ID.' : 'Quizzes created by teachers will appear in this directory.'}</p>
          </div>
        {/if}
      </section>
      <section class="dashboard-section admin-assessments" aria-labelledby="admin-assessments-title">
        <div class="section-heading">
          <div>
            <h2 id="admin-assessments-title">Scheduled assessments <span class="directory-count">{sessions.length}</span></h2>
            <p class="page-copy">Administrators can take an assessment. Your attempt will be saved under your administrator account.</p>
          </div>
        </div>
        {#if sessions.length}
          <div class="admin-assessment-list">
            {#each sessions as session (idOf(session))}
              <article class="admin-assessment-row">
                <div>
                  <h3>{sessionTitle(session)}</h3>
                  <p>{dateLabel(session.start_time)} – {dateLabel(session.end_time)} · {session.max_attempts} allowed attempt{session.max_attempts === 1 ? '' : 's'}</p>
                </div>
                <a class="dashboard-button" href={`/quiz/?session_id=${encodeURIComponent(idOf(session))}`}>
                  Take assessment <span aria-hidden="true">→</span>
                </a>
              </article>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <h3>No scheduled assessments.</h3>
            <p>Scheduled exams will appear here when teachers or administrators create them.</p>
          </div>
        {/if}
      </section>
      <section class="dashboard-section admin-directory" aria-labelledby="account-directory-title">
        <div class="section-heading">
          <div>
            <h2 id="account-directory-title">Accounts <span class="directory-count">{adminUsers.length}</span></h2>
          </div>
          <div class="directory-controls">
            <label class="directory-search">
              <span class="visually-hidden">Search accounts</span>
              <input bind:value={userSearch} type="search" placeholder="Search name, email or ID" />
            </label>
            <label class="directory-role-filter">
              <span class="visually-hidden">Filter accounts by role</span>
              <select bind:value={userRoleFilter}>
                <option value="all">All roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="administrator">Administrators</option>
              </select>
            </label>
          </div>
        </div>
        {#if filteredAdminUsers.length}
          <div class="directory-list">
            {#each filteredAdminUsers as account (userId(account))}
              {@const profile = profileOf(account)}
              {@const accountIsSelf = String(userId(account)).toLowerCase() === String(userId(user)).toLowerCase()}
              <article class="directory-row">
                <div class="directory-main">
                  <div class="directory-person">
                    <h3>{account.name || account.username || account.email || 'Unnamed account'}</h3>
                    <p>{account.email || 'No email'}{account.username ? ` · @${account.username}` : ''}</p>
                  </div>
                  <span class="directory-role" class:role-admin={account.role === 'administrator'}>{account.role || 'Unassigned'}</span>
                  <div class="directory-detail">
                    <code>{userId(account) || '—'}</code>
                  </div>
                  <span class="directory-date">{dateLabel(account.created_at || account.created_on)}</span>
                  <button type="button" class="directory-edit" onclick={() => openAccountEditor(account)} aria-label={`Manage ${account.name || account.username || 'account'}`}>
                    Manage <span aria-hidden="true">↗</span>
                  </button>
                </div>
                <div class="directory-profile-summary">
                  {#if profile.institute?.name || profile.institute_name || profile.institute_id}
                    <span>{profile.institute?.name || profile.institute_name || profile.institute_id}</span>
                  {/if}
                  {#if profile.institute_member_number}<span>No. {profile.institute_member_number}</span>{/if}
                  {#if profile.phone}<span>{profile.phone}</span>{/if}
                  {#if profile.timezone}<span>{profile.timezone}</span>{/if}
                  {#if accountIsSelf}<span class="self-account-note">Your account</span>{/if}
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <div class="directory-empty">
            {#if adminUsers.length}
              <h3>No matching accounts.</h3>
              <p>Try a different search or role filter.</p>
            {:else}
              <h3>No accounts to show yet.</h3>
              <p>Accounts will appear here as they join the platform.</p>
            {/if}
          </div>
        {/if}
      </section>
    {:else}
      <section class="empty-state">
        <h2>Your account role is not recognized.</h2>
        <p>Contact an administrator to check your account access.</p>
      </section>
    {/if}
  {/if}
</main>

{#if accountDialog}
  <div class="account-dialog-backdrop">
    <div
      class="account-dialog"
      bind:this={dialogElement}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-dialog-title"
      tabindex="-1"
    >
      <header class="account-dialog-header">
        <div>
          <p class="eyebrow">{accountDialog === 'create' ? 'NEW ACCOUNT' : accountDialog === 'delete' ? 'CONFIRM REMOVAL' : 'ACCOUNT DETAILS'}</p>
          <h2 id="account-dialog-title">
            {accountDialog === 'create' ? 'Create account' : accountDialog === 'delete' ? 'Delete account?' : (selectedAccount?.name || selectedAccount?.username || 'Manage account')}
          </h2>
        </div>
        <button class="dialog-close" type="button" onclick={closeAccountManager} aria-label="Close account manager">×</button>
      </header>

      {#if accountError}<p class="dashboard-form-error dialog-error" role="alert">{accountError}</p>{/if}
      {#if accountMessage}<p class="dashboard-form-success" role="status">{accountMessage}</p>{/if}

      {#if accountDialog === 'create'}
        <form class="account-form" onsubmit={createAccount}>
          <label>
            <span>Username</span>
            <input bind:value={accountUsername} required maxlength="255" autocomplete="username" />
          </label>
          <label>
            <span>Email</span>
            <input bind:value={accountEmail} type="email" required autocomplete="email" />
          </label>
          <label>
            <span>Temporary password</span>
            <input bind:value={accountPassword} type="password" required autocomplete="new-password" />
          </label>
          <label>
            <span>Role</span>
            <select bind:value={accountRole}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="administrator">Administrator</option>
            </select>
          </label>
          <div class="dialog-actions">
            <button class="dashboard-secondary" type="button" onclick={closeAccountManager}>Cancel</button>
            <button class="dashboard-button" type="submit" disabled={accountSaving}>
              {accountSaving ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
      {:else if accountDialog === 'delete'}
        <div class="delete-confirm">
          <p>This will permanently remove <strong>{selectedAccount?.name || selectedAccount?.username || selectedAccount?.email}</strong> and cannot be undone.</p>
          <div class="dialog-actions">
            <button class="dashboard-secondary" type="button" onclick={() => (accountDialog = 'edit')}>Cancel</button>
            <button class="danger-button" type="button" onclick={deleteAccount} disabled={accountSaving || isOwnAccount}>
              {accountSaving ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </div>
      {:else if accountLoading}
        <p class="dialog-loading" role="status">Loading account details…</p>
      {:else if selectedAccount}
        <div class="account-id-line"><span>Account ID</span><code>{editingUserId}</code></div>
        <form class="account-form" onsubmit={saveAccount}>
          <div class="account-form-heading">
            <h3>Sign-in and access</h3>
          </div>
          <label>
            <span>Username</span>
            <input bind:value={accountUsername} required maxlength="255" autocomplete="username" />
          </label>
          <label>
            <span>Email</span>
            <input bind:value={accountEmail} type="email" required autocomplete="email" />
          </label>
          <label>
            <span>Role</span>
            <select bind:value={accountRole}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="administrator">Administrator</option>
            </select>
          </label>
          <button class="dashboard-button" type="submit" disabled={accountSaving || (isOwnAccount && accountRole !== user.role)}>
            {accountSaving ? 'Saving…' : 'Save account'}
          </button>
          {#if isOwnAccount}<small class="dialog-hint">You cannot change your own administrator role.</small>{/if}
        </form>

        <form class="account-form profile-editor" onsubmit={saveAccountProfile}>
          <div class="account-form-heading">
            <h3>Academic profile</h3>
            <span>{profileExists ? 'Profile on file' : 'No profile yet'}</span>
          </div>
          <label>
            <span>Display name</span>
            <input bind:value={profileName} maxlength="255" required />
          </label>
          <label>
            <span>Institute</span>
            <select bind:value={profileInstituteId} required={!profileExists}>
              <option value="">Select an institute</option>
              {#each institutes as institute}
                <option value={String(institute.id ?? institute.institute_id)}>{institute.institute_name || institute.name || institute.title || `Institute ${institute.id ?? institute.institute_id}`}</option>
              {/each}
            </select>
          </label>
          <div class="account-form-pair">
            <label>
              <span>Member number</span>
              <input bind:value={profileMemberNumber} maxlength="64" />
            </label>
            <label>
              <span>Phone</span>
              <input bind:value={profilePhone} maxlength="30" type="tel" />
            </label>
          </div>
          <label>
            <span>Time zone</span>
            <input bind:value={profileTimezone} maxlength="64" required />
          </label>
          <button class="dashboard-button" type="submit" disabled={accountSaving || (!profileExists && !profileInstituteId)}>
            {accountSaving ? 'Saving…' : profileExists ? 'Save profile' : 'Create profile'}
          </button>
        </form>

        <footer class="account-dialog-footer">
          <span>{isOwnAccount ? 'Your account cannot be deleted here.' : 'Account removal is permanent.'}</span>
          <button type="button" class="delete-link" onclick={() => (accountDialog = 'delete')} disabled={isOwnAccount}>
            Delete account
          </button>
        </footer>
      {/if}
    </div>
  </div>
{/if}

<svelte:window onkeydown={closeAccountDialog} />
