<script>
import { authentication, createDirectus, rest } from "@directus/sdk";
import { onMount } from 'svelte';
import { fade } from 'svelte/transition';
import { directusFetch } from '../../lib/directusFetch.ts';
const client = createDirectus('https://admin.urikabioworks.com').with(authentication()).with(rest());

// from props
export let publication_id;

// "global" state that determines which form to show
let step = '';
let loading = false;

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

// called when user first visits page
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
});

async function handleEmailSubmit() {
    errorMessage = '';
    loading = true;
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
        } else {
            step = 'registration';
        }
    } catch (err) {
        console.error('Error in handleEmailSubmit:', err);
        errorMessage = 'Failed to submit email.';
    } finally {
        loading = false;
    }
}

async function handleRegistrationSubmit() {
    errorMessage = '';
    loading = true;
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
                    publication: publication_id,
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
    } finally {
        loading = false;
    }
}

async function handleOtpSubmit() {
    errorMessage = '';
    loading = true;
    try {
        const submitOtp = otp.toString();
        const res = await fetch('https://admin.urikabioworks.com/otp-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, otp: submitOtp }),
        });
        const response = await res.json();
        if (response?.refresh_token) {
            accessToken = response.access_token;
            refreshToken = response.refresh_token || '';
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);

            // fetch user data and leads data in parallel
            const [userRes, leadRes] = await Promise.all([
                directusFetch('https://admin.urikabioworks.com/users/me?fields=first_name,last_name,email'),
                directusFetch(`https://admin.urikabioworks.com/items/leads?filter[user][_eq]=${userId}`)
            ]);
            if (!userRes.ok || !leadRes.ok) {
                throw new Error('Failed to fetch user or leads data');
            }
            const [userData, leadsData] = await Promise.all([userRes.json(), leadRes.json()]);
            const user = userData.data;
            const lead = leadsData.data?.[0];
            if (user) {
                firstName = user.first_name;
                lastName = user.last_name;
                email = user.email;
                localStorage.setItem('first_name', firstName || '');
                localStorage.setItem('last_name', lastName || '');
                localStorage.setItem('email', email || '');
            }
            if (lead) {
                company = lead.company;
                title = lead.title;
                localStorage.setItem('company', company || '');
                localStorage.setItem('title', title || '');
            }

            // trigger Lead activation webhook
            const flowRes = await directusFetch('https://admin.urikabioworks.com/flows/trigger/fb1a39c5-5c13-477c-bfbe-3baf4222d079', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            if (!flowRes.ok) {
                throw new Error('Failed to trigger Lead activation webhook');
            }
            message = '';
            step = 'logged-in';
        } else {
            throw new Error(response.message);
        }
    } catch (err) {
        console.error('Error in handleOtpSubmit:', err);
        errorMessage = 'Failed to verify OTP.';
    } finally {
        loading = false;
    }
}

// this is needed because Safari blocks blobs in newtab if window.open is called from an async function
function handleFileDownload() {
    const newTab = window.open('', '_blank');
    newTab.document.write('<h1 style="text-align: center">Downloading...</h1>');
    downloadFile(newTab);
}

async function downloadFile(newTab) {
    errorMessage = '';
    loading = true;
    try {
        const paper_id = await directusFetch(`https://admin.urikabioworks.com/items/publications?filter[id][_eq]=${publication_id}`);
        if (!paper_id.ok) throw new Error('Failed to fetch paper id');
        const paper = await paper_id.json();
        const fileId = paper.data[0].paper;

        const res = await directusFetch(`https://admin.urikabioworks.com/assets/${fileId}`);
        if (!res.ok) throw new Error('Failed to fetch file');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        // Open the file in a new tab
        newTab.location.href = url;

        // hit the webhook to create a new Publications Read record
        const readRes = await directusFetch('https://admin.urikabioworks.com/flows/trigger/e6002984-a859-4132-9044-bca316d0c98c', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, publication_id }),
        });
        if (!readRes.ok) throw new Error('Failed to trigger Publications Read webhook');

        // Optionally revoke the URL after some time to free up memory
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
        console.error('Error fetching file:', err);
        errorMessage = 'Failed to download file.';
    } finally {
        loading = false;
    }
}
</script>

<div class="flex flex-col h-full md:min-w-96 mx-auto border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2 justify-center">
    {#if step === 'enter-email'}
    <form on:submit|preventDefault={handleEmailSubmit} in:fade={{ duration: 400 }}>
        {#if errorMessage}
            <div class="text-lg text-center px-12 py-6 rounded-2xl bg-red-100 dark:bg-red-950 text-red-900 dark:text-white mb-6" in:fade={{ duration: 300 }}>
            <p><span class="font-bold">ERROR: </span> {errorMessage}</p>
            </div>
        {/if}
        <div class="flex flex-col justify-center my-4 text-center">
            <h2 class="text-center font-bold text-xl">Access Publication</h2>
            <p>Enter your email address to read the full document.</p>
        </div>
        <input required class="py-2 textinput" type="email" bind:value={email} placeholder="your@address.com" autocomplete="on" />
        <button class="button" type="submit">
            Next
            {#if loading}
                <span class="spinner"></span>
            {/if}
        </button>
    </form>

    {:else if step === 'registration'}
    <form on:submit|preventDefault={handleRegistrationSubmit} in:fade={{ duration: 400 }}>
        {#if errorMessage}
            <div class="text-lg text-center px-12 py-6 rounded-2xl bg-red-100 dark:bg-red-950 text-red-900 dark:text-white mb-6" in:fade={{ duration: 300 }}>
                <p><span class="font-bold">ERROR: </span> {errorMessage}</p>
            </div>
        {/if}
        <div class="flex flex-col justify-center my-4 text-center">
            <h2 class="text-center font-bold text-xl">Register</h2>
            <p>Let us know who you are!</p>
        </div>
        <input disabled class="py-2 textinput text-base" type="email" bind:value={email} placeholder="your@address.com *" />
        <div class="flex flex-col md:flex-row md:gap-4">
            <input required autofocus class="py-2 textinput text-base" type="text" bind:value={firstName} placeholder="First Name *" />
            <input required class="py-2 textinput text-base" type="text" bind:value={lastName} placeholder="Last Name *" />
        </div>
        <div class="flex flex-col md:flex-row md:gap-4">
            <input required class="py-2 textinput text-base" type="text" bind:value={company} placeholder="Company *" />
            <input required class="py-2 textinput text-base" type="text" bind:value={title} placeholder="Title *" />
        </div>
        <textarea required class="py-2 textinput text-base" bind:value={message} placeholder="Your introductory message..."></textarea>
        <button class="button" type="submit">
            Register
            {#if loading}
                <span class="spinner"></span>
            {/if}
        </button>
    </form>

    {:else if step === 'otp'}
    <form on:submit|preventDefault={handleOtpSubmit} in:fade={{ duration: 400 }}>
        {#if errorMessage}
            <div class="text-lg text-center px-12 py-6 rounded-2xl bg-red-100 dark:bg-red-950 text-red-900 dark:text-white mb-6" in:fade={{ duration: 300 }}>
                <p><span class="font-bold">ERROR: </span> {errorMessage}</p>
            </div>
        {/if}
        <div class="flex flex-col justify-center my-4 text-center">
            <h2 class="text-center font-bold text-xl">Verify</h2>
            <p>Please check your email for the <span class="font-bold text-urika-orange-400">verification code.</span></p>
        </div>
        <input autofocus class="py-2 textinput text-center" type="number" inputmode="decimal" bind:value={otp} placeholder="000000" />
        <button class="button" type="submit">
            Verify
            {#if loading}
                <span class="spinner"></span>
            {/if}
        </button>
    </form>

    {:else if step === 'logged-in'}
    <div class="flex flex-col text-center" in:fade={{ duration: 400 }} disabled={loading}>
        {#if errorMessage}
            <div class="text-lg text-center px-12 py-6 rounded-2xl bg-red-100 dark:bg-red-950 text-red-900 dark:text-white mb-6" in:fade={{ duration: 300 }}>
                <p><span class="font-bold">ERROR: </span> {errorMessage}</p>
            </div>
        {/if}
        <div class="flex flex-col justify-center my-4 text-center">
            <h2 class="text-center font-bold text-xl">Thank you, {firstName}.</h2>
            <p>Feel free to peruse our publications!</p>
        </div>
        <button class="button" on:click={handleFileDownload}>
            ACCESS THE PAPER
            {#if loading}
                <span class="spinner"></span>
            {/if}
        </button>
    </div>
    {/if}
</div>
