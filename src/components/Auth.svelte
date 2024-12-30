<script>
  import { authentication, createDirectus, rest } from "@directus/sdk";
  const client = createDirectus('https://admin.urikabioworks.com').with(authentication()).with(rest());
  import { onMount } from 'svelte';
  import { directusFetch } from '../../lib/directusFetch.ts'

  // "Global" state that determines which form to show
  let step = 'enter-email';

  let email = 'bogdan.boskovic@urikabioworks.com';
  const randomPassword = (length=12) => Math.random().toString(20)
  let password = randomPassword();
  let firstName = '';
  let lastName = '';
  let company = '';
  let title = '';
  let message = '';
  let otp = '';
  let accessToken = '';
  let refreshToken = '';

  // Called when user first visits page
  onMount(() => {
    const storedAccessToken = localStorage.getItem('publications.access_token');
    const storedRefreshToken = localStorage.getItem('publications.refresh_token');
    if (storedAccessToken) {
      client.setToken(storedAccessToken)
      accessToken = storedAccessToken;
      refreshToken = storedRefreshToken; // might be null if not stored yet
      step = 'success'; // or validate token with an API call
    }
  });

  // 1) Submit email to Flow 1 (check if user exists, possibly trigger Flow 2 or tell us to register).
  async function handleEmailSubmit() {
    try {
      const res = await directusFetch('https://admin.urikabioworks.com/flows/trigger/8dccc9f3-e88e-4d6f-be2b-85ec39d4a9d6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.user_exists === true) {
        step = 'otp';
      } else {
        console.log(data.user_exists)
        step = 'registration';
      }
    } catch (err) {
      console.error('Error in handleEmailSubmit:', err);
    }
  }

  // 2) Register new user, then (Flow 4) triggers Flow 2 to generate OTP
  async function handleRegistrationSubmit() {
    try {
      const res = await directusFetch('https://admin.urikabioworks.com/flows/trigger/flow4-register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          company,
          title,
          message
        })
      });
      const data = await res.json();
      /**
       * If successful, the response might indicate that it triggered Flow 2
       * so the user can proceed to "otp" step.
       */
      if (data.success) {
        step = 'otp';
      } else {
        console.error('Registration failed:', data);
      }
    } catch (err) {
      console.error('Error in handleRegistrationSubmit:', err);
    }
  }

  // 3) Verify OTP (Flow 3), get tokens if successful
  async function handleOtpSubmit() {
    try {
      const focusField = document.querySelector('.focus');
      if (focusField) { focusField.focus(); focusField.select(); }

      const res = await directusFetch('https://admin.urikabioworks.com/flows/trigger/533b7ee1-04aa-4930-9e07-abab76fe53d8', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const response = await res.json();
      /**
       * If valid, Flow 3 would have:
       *  - set user status to "Active"
       *  - done an internal POST to /auth/login
       *  - returned { "access_token": "...", "refresh_token": "..." }
       */
      if (response.data.access_token) {
        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token || '';

        localStorage.setItem('publications.access_token', accessToken);
        localStorage.setItem('publications.refresh_token', refreshToken);

        step = 'success';
      } else {
        console.error('OTP validation failed:', response);
      }
    } catch (err) {
      console.error('Error in handleOtpSubmit:', err);
    }
  }
</script>

{#if step === 'enter-email'}
  <div>
    <h2>Access Publications</h2>
    <p>Enter your email address to continue.</p>
    <input class="textinput" type="email" bind:value={email} placeholder="you@example.com" autocomplete="on" />
    <button class="button" on:click={handleEmailSubmit}>Next</button>
  </div>

{:else if step === 'registration'}
  <div>
    <h2>Register</h2>
    <input class="textinput" type="email" value={email} placeholder="your@address.com *" />
    <div class="flex flex-col md:flex-row gap-4">
        <input autofocus class="textinput focus" type="text" bind:value={firstName} placeholder="First Name *" />
        <input class="textinput" type="text" bind:value={lastName} placeholder="Last Name *" />
    </div>
    <div class="flex flex-col md:flex-row gap-4">
        <input class="textinput" type="text" bind:value={company} placeholder="Company *" />
        <input class="textinput" type="text" bind:value={title} placeholder="Title *" />
    </div>
    <textarea class="textinput" bind:value={message} placeholder="Your introductory message..."></textarea>
    <button class="button" on:click={handleRegistrationSubmit}>Register</button>
  </div>

{:else if step === 'otp'}
  <div>
    <h2>Check your email for your OTP</h2>
    <input autofocus class="textinput focus" type="text" bind:value={otp} placeholder="Enter OTP code" />
    <button class="button" on:click={handleOtpSubmit}>Submit OTP</button>
  </div>

{:else if step === 'success'}
  <div>
    <h2>Success!</h2>

    <p>You are logged in. Now you can access protected content.</p>
  </div>
{/if}
