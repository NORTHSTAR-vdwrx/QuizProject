<script>
  import SiteHeader from '../../components/SiteHeader.svelte';
</script>

<svelte:head>
  <title>Eval. | Home</title>
</svelte:head>

<SiteHeader />

<main class="page-shell">
  <p class="eyebrow">NORTHSTAR EVAL / ROUTE EXAMPLES</p>
  <h1 class="page-title">Choose a page</h1>
  <p class="page-copy">Each example lives in its own URL folder, with its page component and entry point grouped together.</p>

  <ul class="route-list">
    <li><a class="route-link" href="/quiz/">/quiz/ <span>Try a sample question</span></a></li>
    <li><a class="route-link" href="/results/">/results/ <span>View a sample results page</span></a></li>
  </ul>
</main>