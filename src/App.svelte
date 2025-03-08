<script lang="ts">
  import { user } from './lib/auth';
  import Login from './routes/Login.svelte';
  import Calendar from './routes/Calendar.svelte';
</script>

<main class="min-h-screen bg-gray-50">
  {#if $user}
    <Calendar />
  {:else}
    <Login />
  {/if}
  }
</main>

<style global>
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
</style>