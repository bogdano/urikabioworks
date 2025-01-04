<script>
  import { authentication, createDirectus, rest } from "@directus/sdk";
  const client = createDirectus('https://admin.urikabioworks.com').with(authentication()).with(rest());
  import { onMount } from 'svelte';

  // "Global" state that determines which form to show
  let step = 'enter-email';

  let userId = '';
  let email = '';
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
  onMount(async () => {
    try {
        // Make a request to check if there's a valid session
        const res = await fetch('https://admin.urikabioworks.com/users/me', {
          // Ensure we include credentials (the session cookie)
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Not logged in');

        const data = await res.json();
        // If Directus returns a valid user
        if (data?.data?.id) {
          step = 'logged-in';
        }
      } catch (err) {
        console.log('No valid session:', err);
    }
    const firstField = document.getElementById('firstField');
    setTimeout(() => firstField?.focus(), 400);
  });

  // 1) Submit email to Flow 1 (check if user exists, possibly trigger Flow 2 or tell us to register).
  async function handleEmailSubmit() {
    try {
      const res = await fetch('https://admin.urikabioworks.com/flows/trigger/8dccc9f3-e88e-4d6f-be2b-85ec39d4a9d6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include'
      });
      const data = await res.json();
      if (data.user_exists === true) {
        step = 'otp';
        userId = data.id;
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
      const res = await fetch('https://admin.urikabioworks.com/flows/trigger/91684db5-7bdb-47dd-8255-d6d7f1d7bea4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          company,
          title,
          message,
          source: 'publications'
        }),
        credentials: 'include'
      });
      const data = await res.json();
      /**
       * If successful, the response might indicate that it triggered Flow 2
       * so the user can proceed to "otp" step.
       */
      if (data.user_created === true) {
        step = 'otp';
      } else {
        console.error('Registration failed:', data);
        step = 'enter-email';
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

      const res = await fetch('https://admin.urikabioworks.com/otp-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, otp, session: true })
      });
      const response = await res.json();
      /**
       * If valid, Flow 3 would have:
       *  - set user status to "Active"
       *  - done an internal POST to /auth/login
       *  - returned { "access_token": "...", "refresh_token": "..." }
       */
      if (response.refresh_token) {
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
    <input class="textinput" type="email" bind:value={email} placeholder="your@address.com *" />
    <div class="flex flex-col md:flex-row gap-4">
        <input class="textinput focus" type="text" bind:value={firstName} placeholder="First Name *" />
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
    <input class="textinput focus" type="text" bind:value={otp} placeholder="Enter OTP code" />
    <button class="button" on:click={handleOtpSubmit}>Submit OTP</button>
  </div>

{:else if step === 'success'}
  <div>
    <h2>Success!</h2>

    <p>You are logged in. Now you can access protected content.</p>
  </div>
{/if}
