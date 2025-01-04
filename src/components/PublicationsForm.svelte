<script>
import { authentication, createDirectus, rest } from "@directus/sdk";
import { onMount } from 'svelte';
import { fade } from 'svelte/transition';
import { directusFetch } from '../../lib/directusFetch.ts';
    import directus from "../../lib/directus.ts";
const client = createDirectus('https://admin.urikabioworks.com').with(authentication()).with(rest());

// "Global" state that determines which form to show
let step = 'enter-email';

let userId = '';
let email = '';
let firstName = '';
let lastName = '';
let company = '';
let title = '';
let message = '';
let otp = '';
let accessToken = '';
let refreshToken = '';
let errorMessage = '';
let alertMessage = '';

// Called when user first visits page
onMount(async () => {
    accessToken = localStorage.getItem('access_token');
    refreshToken = localStorage.getItem('refresh_token');
    firstName = localStorage.getItem('first_name');
    lastName = localStorage.getItem('last_name');
    email = localStorage.getItem('email');
    title = localStorage.getItem('title');
    company = localStorage.getItem('company');

    if (accessToken) {
        client.setToken(accessToken);
        step = 'logged-in';
    } else {
        step = 'enter-email';
    }

    const firstField = document.getElementById('firstField');
    setTimeout(() => firstField?.focus(), 400);
});

async function handleEmailSubmit() {
    try {
      const res = await directusFetch(
          'https://admin.urikabioworks.com/flows/trigger/8dccc9f3-e88e-4d6f-be2b-85ec39d4a9d6',
          {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
          }
      );
      const data = await res.json();
      if (data.user_exists) {
          step = 'otp';
          userId = data.id;
          alertMessage = 'We already have your email address on file.';
      } else {
          step = 'registration';
      }
    } catch (err) {
        console.error('Error in handleEmailSubmit:', err);
        errorMessage = 'Failed to submit email.';
    }
}

async function handleRegistrationSubmit() {
    errorMessage = '';
    try {
        const res = await directusFetch('https://admin.urikabioworks.com/flows/trigger/91684db5-7bdb-47dd-8255-d6d7f1d7bea4',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    company,
                    title,
                    message,
                    source: 'publications',
                }),
            }
        );
        const data = await res.json();
        if (data.user_created) {
            step = 'otp';
            userId = data.id[0];
        } else {
            throw new Error('Failed to create user');
        }
    } catch (err) {
        console.error('Error in handleRegistrationSubmit:', err);
        errorMessage = 'Failed to create user.';
    }
}

async function handleOtpSubmit() {
    errorMessage = '';
    try {
        const res = await fetch('https://admin.urikabioworks.com/otp-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, otp }),
        });
        const response = await res.json();
        if (response.refresh_token) {
            accessToken = response.access_token;
            refreshToken = response.refresh_token;
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);

            // Fetch user data
            const userRes = await directusFetch('https://admin.urikabioworks.com/users/me?fields=first_name,last_name,email');
            const userData = await userRes.json();
            const user = userData.data;
            if (user) {
                firstName = user.first_name;
                lastName = user.last_name;
                email = user.email;
                localStorage.setItem('first_name', firstName);
                localStorage.setItem('last_name', lastName);
                localStorage.setItem('email', email);
            }
            alertMessage = "You've logged in.";
            step = 'logged-in';
        } else {
            throw new Error(response.message);
        }
    } catch (err) {
      console.error('Error in handleOtpSubmit:', err);
      errorMessage = 'Failed to verify OTP.';
    }
}

async function handleFileDownload() {
    try {
        const fileId = 'aa74b1ea-65d2-41ab-bd84-e321e0886747';

        const res = await directusFetch(`https://admin.urikabioworks.com/assets/${fileId}`)

        if (!res.ok) throw new Error('Failed to fetch file');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        // Open the file in a new tab
        window.open(url, '_blank');

        // Optionally revoke the URL after some time to free up memory
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
        console.error('Error fetching file:', err);
        errorMessage = 'Failed to download file.';
    }
}
</script>

<div class="max-w-2xl mx-auto">
    {#if step === 'enter-email'}
    <form on:submit|preventDefault={handleEmailSubmit} in:fade={{ duration: 400 }}>
        <h2>Access Publications</h2>
        <p>Enter your email address to continue.</p>
        <input autofocus class="textinput" type="email" bind:value={email} placeholder="you@example.com" autocomplete="on" />
        <button class="button" type="submit">Next</button>
    </form>

    {:else if step === 'registration'}
    <form on:submit|preventDefault={handleRegistrationSubmit} in:fade={{ duration: 400 }}>
        <h2>Register</h2>
        <input class="textinput" type="email" bind:value={email} placeholder="your@address.com *" />
        <div class="flex flex-col md:flex-row gap-4">
            <input class="textinput" type="text" bind:value={firstName} placeholder="First Name *" />
            <input class="textinput" type="text" bind:value={lastName} placeholder="Last Name *" />
        </div>
        <div class="flex flex-col md:flex-row gap-4">
            <input class="textinput" type="text" bind:value={company} placeholder="Company *" />
            <input class="textinput" type="text" bind:value={title} placeholder="Title *" />
        </div>
        <textarea class="textinput" bind:value={message} placeholder="Your introductory message..."></textarea>
        <button class="button" type="submit">Register</button>
    </form>

    {:else if step === 'otp'}
    <form on:submit|preventDefault={handleOtpSubmit} in:fade={{ duration: 400 }}>
        <h2>Check your email for your OTP</h2>
        <input autofocus class="textinput" type="text" bind:value={otp} placeholder="Enter OTP code" />
        <button class="button" type="submit">Submit OTP</button>
    </form>

    {:else if step === 'logged-in'}
    <div class="flex flex-col gap-2 text-center">
        <h2>Success!</h2>
        <p>You are logged in. Now you can access protected content.</p>
        <button class="button" on:click={handleFileDownload}>ACCESS PAPER</button>
    </div>
    {/if}
</div>
