<script lang="ts">
  import { initiateOAuthLogin } from '../lib/auth';
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Phone Booking System
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Sign in with your Recurse Center account to book phone rooms
      </p>
    </div>
    <div class="mt-8 space-y-6">
      <div>
        <button
          on:click={initiateOAuthLogin}
          class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Sign in with Recurse Center
        </button>
      </div>
    </div>
  </div>
</div>