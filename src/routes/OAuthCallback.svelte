<script lang="ts">
  import { onMount } from "svelte";
  import { user } from "../lib/auth";
  import { AUTH_CALLBACK_URL } from "../lib/apiConfig";

  let error = "";
  let loading = true;
  let tokenError = false;

  onMount(async () => {
    try {
      // Get the authorization code from URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");

      if (!code) {
        error = "No authorization code found in the URL.";
        loading = false;
        return;
      }

      // Check if we already attempted this code (to prevent multiple attempts with the same code)
      const usedCodes = localStorage.getItem("usedAuthCodes") || "[]";
      const codeArray = JSON.parse(usedCodes);

      if (codeArray.includes(code)) {
        // This code has been used before, likely an expired or already-used code
        error =
          "This authorization code has already been used. Please start the login process again.";
        tokenError = true;
        loading = false;
        return;
      }

      // Store this code as used
      codeArray.push(code);
      localStorage.setItem("usedAuthCodes", JSON.stringify(codeArray));

      // Use our backend server to exchange the code for a token
      const response = await fetch(AUTH_CALLBACK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("OAuth callback error response:", errorData);

        // Check for invalid_grant error
        if (errorData.details && errorData.details.error === "invalid_grant") {
          error =
            "Your login session has expired. Please try logging in again.";
          tokenError = true;
        } else {
          error =
            errorData.error || "Failed to authenticate with Recurse Center";
        }
        loading = false;
        return;
      }

      // Process the user data response
      const userData = await response.json();

      // Store the user data in localStorage and update the user store
      localStorage.setItem("recurse_user", JSON.stringify(userData));
      user.set(userData);

      // Redirect to the main page
      window.location.href = "/";
    } catch (err) {
      console.error("OAuth callback error:", err);
      error =
        err instanceof Error
          ? err.message
          : "An error occurred during authentication.";
      loading = false;
    }
  });
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
  <div class="max-w-md w-full space-y-8 p-6 bg-white shadow-md rounded-lg">
    {#if loading}
      <div class="text-center">
        <h2 class="text-xl font-semibold mb-4">
          Authenticating with Recurse Center...
        </h2>
        <div class="flex justify-center">
          <div
            class="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"
          ></div>
        </div>
      </div>
    {:else if error}
      <div class="text-center">
        <h2 class="text-xl font-semibold mb-2 text-red-600">
          Authentication Error
        </h2>
        <p class="text-gray-700 mb-4">{error}</p>

        {#if tokenError}
          <a
            href="/"
            class="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Return to Login
          </a>
        {:else}
          <div class="flex flex-col space-y-2">
            <a
              href="/"
              class="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Return to Login
            </a>
            <button
              on:click={() => window.location.reload()}
              class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Try Again
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
