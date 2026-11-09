<script>
  import { onMount } from 'svelte';
  import SiteHeader from '../../components/SiteHeader.svelte';
  import { apiRequest, asList, displayError, unwrap } from '../../lib/api.js';

  let attempts = [];
  let attempt = null;
  let loading = true;
  let errorMessage = '';
  const searchParams = new URLSearchParams(window.location.search);
  const attemptId = searchParams.get('attempt_id');
  const logError = searchParams.get('log_error');

  onMount(async () => {
    try {
      if (attemptId) {
        attempt = unwrap(await apiRequest(`/attempts/${encodeURIComponent(attemptId)}`), 'attempt');
      } else {
        attempts = asList(await apiRequest('/attempts/mine'));
      }
    } catch (error) {
      errorMessage = displayError(error, 'Could not load your assessment results.');
    } finally {
      loading = false;
    }
  });

  function titleOf(item) {
    return item.title || item.quiz_title || item.quiz?.title || `Assessment ${item.id ?? item.attempt_id}`;
  }

  function statusOf(item) {
    return item.status || (item.submitted_at ? 'Submitted' : 'In progress');
  }
  $: score = attempt?.score ?? attempt?.points_earned;
  $: total = attempt?.total_points ?? attempt?.max_score;
</script>

<svelte:head>
  <title>Eval. | {attempt ? 'Assessment results' : 'My attempts'}</title>
  <meta name="description" content="Review your submitted assessments and attempts." />
</svelte:head>

<SiteHeader />

<main class="page-shell results-shell">
  {#if loading}
    <p class="page-copy" role="status">Loading your attempts…</p>
  {:else if errorMessage}
    <section class="results-empty" role="alert">
      <p>{errorMessage}</p>
      <a class="results-link" href="/home/">Back to your space <span aria-hidden="true">→</span></a>
    </section>
  {:else if attempt}
    <p class="eyebrow">ASSESSMENT COMPLETE</p>
    <h1 class="page-title">{titleOf(attempt)}</h1>
    <p class="page-copy">Your attempt has been submitted. Your teacher’s review and scoring will appear here when available.</p>
    {#if logError}
      <p class="results-warning" role="status">Your answers were submitted, but the activity log could not be saved: {logError}</p>
    {/if}
    {#if score !== undefined && score !== null}
      <section class="score-card" aria-label="Assessment score">
        <span class="score-value">{score}{total !== undefined && total !== null ? ` / ${total}` : ''}</span>
        {#if total !== undefined && total !== null && Number(total) > 0}
          <span class="score-percent">{Math.round((Number(score) / Number(total)) * 100)}%</span>
        {/if}
      </section>
    {:else}
      <div class="results-pending">
        <span class="pending-mark" aria-hidden="true">✓</span>
        <div><strong>Submitted</strong><p>Answers saved. Results are not available yet.</p></div>
      </div>
    {/if}
    <a class="results-link" href="/results/">View all attempts <span aria-hidden="true">→</span></a>
  {:else}
    <p class="eyebrow">YOUR PROGRESS</p>
    <h1 class="page-title">Assessment history.</h1>
    <p class="page-copy">Submitted and in-progress attempts stay together here.</p>
    {#if attempts.length}
      <div class="attempt-list">
        {#each attempts as item (item.id ?? item.attempt_id)}
          <article class="attempt-row">
            <div>
              <span class="attempt-status">{statusOf(item)}</span>
              <h2>{titleOf(item)}</h2>
              <p>{item.submitted_at || item.updated_at || item.created_at || 'Attempt saved'}</p>
            </div>
            <a class="results-link" href={`/results/?attempt_id=${encodeURIComponent(item.id ?? item.attempt_id)}`}>
              Review <span aria-hidden="true">→</span>
            </a>
          </article>
        {/each}
      </div>
    {:else}
      <section class="results-empty">
        <h2>No attempts yet.</h2>
        <p>When you begin an assessment, your progress will be saved here.</p>
        <a class="results-link" href="/quiz/">Find an assessment <span aria-hidden="true">→</span></a>
      </section>
    {/if}
  {/if}
</main>
