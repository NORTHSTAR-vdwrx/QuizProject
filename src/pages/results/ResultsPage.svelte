<script>
  import SiteHeader from '../../components/SiteHeader.svelte';
</script>

<svelte:head>
  <title>Eval. | Results Example</title>
</svelte:head>

<SiteHeader />

<main class="page-shell">
  <p class="eyebrow">RESULTS EXAMPLE</p>
  <h1 class="page-title">Quiz complete</h1>
  <p class="page-copy">A results page can live beside the quiz page while both reuse shared components and styles.</p>
  <p><strong>Score:</strong> 1 / 1</p>
  <a class="route-link" href="/quiz/">Try the quiz again</a>
</main>