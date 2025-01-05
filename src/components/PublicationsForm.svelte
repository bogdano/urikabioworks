<script>
import { authentication, createDirectus, rest } from "@directus/sdk";
import { onMount } from 'svelte';
import { fade } from 'svelte/transition';
import { directusFetch } from '../../lib/directusFetch.ts';
const client = createDirectus('https://admin.urikabioworks.com').with(authentication()).with(rest());

let { publication_id, publication_title } = $props();

// "Global" state that determines which form to show
let step = $state('');

let userId = '';
let email = $state('');
let firstName = $state('');
let lastName = $state('');
let company = $state('');
let title = $state('');
let message = $state('');
let otp = $state('');
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
        const paper_id = await directusFetch(`https://admin.urikabioworks.com/items/publications?filter[id][_eq]=${publication_id}`);
        if (!paper_id.ok) throw new Error('Failed to fetch paper id');
        const paper = await paper_id.json();
        const fileId = paper.data[0].paper;

        const res = await directusFetch(`https://admin.urikabioworks.com/assets/${fileId}`);
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

<div class="min-w-96 mx-auto border border-zinc-200 dark:border-zinc-800 rounded-2xl px-8 py-4">
    {#if step === 'enter-email'}
    <form on:submit|preventDefault={handleEmailSubmit} in:fade={{ duration: 400 }}>
        <div class="flex flex-col justify-center my-4 text-center">
            <h2 class="text-center font-bold text-xl">Access Publication</h2>
            <p>Enter your email address to read the full document.</p>
        </div>
        <input autofocus class="textinput" type="email" bind:value={email} placeholder="your@address.com" autocomplete="on" />
        <button class="button" type="submit">Next</button>
    </form>

    {:else if step === 'registration'}
    <form on:submit|preventDefault={handleRegistrationSubmit} in:fade={{ duration: 400 }}>
        <div class="flex flex-col justify-center my-4 text-center">
            <h2 class="text-center font-bold text-xl">Register</h2>
            <p>Let us know who you are!</p>
        </div>
        <input disabled class="textinput text-base" type="email" bind:value={email} placeholder="your@address.com *" />
        <div class="flex flex-col md:flex-row md:gap-4">
            <input autofocus class="textinput text-base" type="text" bind:value={firstName} placeholder="First Name *" />
            <input class="textinput text-base" type="text" bind:value={lastName} placeholder="Last Name *" />
        </div>
        <div class="flex flex-col md:flex-row md:gap-4">
            <input class="textinput text-base" type="text" bind:value={company} placeholder="Company *" />
            <input class="textinput text-base" type="text" bind:value={title} placeholder="Title *" />
        </div>
        <textarea class="textinput text-base" bind:value={message} placeholder="Your introductory message..."></textarea>
        <button class="button" type="submit">Register</button>
    </form>

    {:else if step === 'otp'}
    <form on:submit|preventDefault={handleOtpSubmit} in:fade={{ duration: 400 }}>
        <div class="flex flex-col justify-center my-4 text-center">
            <h2 class="text-center font-bold text-xl">Verify</h2>
            <p>Please check your email for the <span class="font-bold text-urika-orange-400">verification code.</span></p>
        </div>
        <input autofocus class="textinput" type="text" bind:value={otp} placeholder="000000" />
        <button class="button" type="submit">Verify</button>
    </form>

    {:else if step === 'logged-in'}
    <div class="flex flex-col text-center" in:fade={{ duration: 400 }}>
        <div class="flex flex-col justify-center my-4 text-center">
            <h2 class="text-center font-bold text-xl">Thank you, {firstName}.</h2>
            <p>Feel free to peruse our publications!</p>
        </div>
        <button class="button" on:click={handleFileDownload}>ACCESS THE PAPER</button>
    </div>
    {/if}
</div>
