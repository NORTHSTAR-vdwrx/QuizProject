<script>
  import SiteHeader from '../../components/SiteHeader.svelte';

  let selectedAnswer = $state('');
  const correctAnswer = 'Mars';
  const answers = ['Venus', 'Mars', 'Jupiter'];
</script>

<svelte:head>
  <title>Eval. | Quiz Example</title>
</svelte:head>

<SiteHeader />

<main class="page-shell">
  <p class="eyebrow">QUIZ EXAMPLE / QUESTION 1 OF 1</p>
  <h1 class="page-title">Which planet is known as the Red Planet?</h1>
  <p class="page-copy">Select an answer to see the page's interactive state.</p>

  <div class="answer-list">
    {#each answers as answer}
      <button
        class="answer-button"
        class:is-selected={selectedAnswer === answer}
        aria-pressed={selectedAnswer === answer}
        onclick={() => (selectedAnswer = answer)}
      >
        {answer}
      </button>
    {/each}
  </div>

  <p class="feedback" aria-live="polite">
    {#if selectedAnswer}
      {selectedAnswer === correctAnswer ? 'Correct.' : 'Not quite. Try another answer.'}
    {/if}
  </p>
</main>