<script lang="ts">
  import { user } from "./lib/auth";
  import Login from "./routes/Login.svelte";
  import SimpleCalendar from "./routes/SimpleCalendar.svelte";
  import OAuthCallback from "./routes/OAuthCallback.svelte";

  // Simple routing
  let path = window.location.pathname;

  // Listen for path changes
  window.addEventListener("popstate", () => {
    path = window.location.pathname;
  });
</script>

<main class="min-h-screen bg-gray-50">
  {#if path === "/oauth/callback"}
    <OAuthCallback />
  {:else if $user}
    <SimpleCalendar />
  {:else}
    <Login />
  {/if}
</main>

<style>
  /* The global styles are imported in app.css, not here */
  /* This prevents the "unused CSS selector" warnings */
</style>
