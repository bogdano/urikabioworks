<script>
    import { authentication, createDirectus, rest } from "@directus/sdk";
    const client = createDirectus('https://admin.urikabioworks.com').with(authentication()).with(rest());
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import { directusFetch } from '../../../lib/directusFetch.ts'

    // "Global" state that determines which form to show
    let step = 'registration';
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
            client.setToken(accessToken)
            step = 'logged-in'; // or validate token with an API call
        } else {
            step = 'registration';
        }
        const firstField = document.getElementById('firstField');
        setTimeout(() => firstField?.focus(), 400);
    });

    async function handleEmailSubmit(e) {
        loading = true;
        try {
            const res = await directusFetch('https://admin.urikabioworks.com/flows/trigger/8dccc9f3-e88e-4d6f-be2b-85ec39d4a9d6', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (data.user_exists) {
                step = 'otp';
                userId = data.id;
                alertMessage = 'We already have your email address on file.';
            }
        } catch (err) {
            console.error('Error in handleEmailSubmit:', err);
        } finally {
            loading = false;
        }
    }

    async function handleRegistrationSubmit() {
        errorMessage = '';
        loading = true;
        try {
            const res = await directusFetch('https://admin.urikabioworks.com/flows/trigger/91684db5-7bdb-47dd-8255-d6d7f1d7bea4', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    company,
                    title,
                    message,
                    source: 'contact_form'
                })
            });
            const data = await res.json();
            if (data.user_created === true) {
                step = 'otp';
                userId = data.id[0];
            } else {
                throw new Error('Failed to create user', data.error);
                step = 'registration';
            }
        } catch (err) {
            console.error('Error in handleRegistrationSubmit:', err);
            errorMessage = 'Failed to create user' + err;
        } finally {
            loading = false;
        }
    }

    async function handleOtpSubmit() {
        loading = true;
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
                throw new Error(JSON.stringify(response.message));
            }
        } catch (err) {
            console.error('Error in handleOtpSubmit:', err);
            errorMessage = err;
        } finally {
            loading = false;
        }
    }

    async function handleSupplementSubmit() {
        loading = true;
        try {
            const res = await directusFetch('https://admin.urikabioworks.com/flows/trigger/d840e527-baac-4d27-83c4-2c268fd022db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    first_name: firstName,
                    last_name: lastName,
                    company,
                    title,
                    message,
                })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('first_name', firstName);
                localStorage.setItem('last_name', lastName);
                localStorage.setItem('company', company);
                localStorage.setItem('title', title);
                step = 'logged-in';
                message = '';
                alertMessage = data.alertMessage;
            } else {
                throw new Error(data.error);
                step = 'logged-in';
            }
        } catch (err) {
            console.error('Error in handleSupplementSubmit:' + JSON.stringify(err));
            alertMessage = err;
        } finally {
            loading = false;
        }
    }
</script>

<div class="max-w-5xl mx-auto">
    {#if step === 'registration'}
    <form class="stagger-container" on:submit|preventDefault={handleRegistrationSubmit}>
        {#if errorMessage}
            <div class="text-lg text-center px-12 py-6 rounded-2xl bg-red-100 dark:bg-red-950 text-red-900 dark:text-white mb-6" in:fade={{ duration: 300 }}>
            <p><span class="font-bold">ERROR: </span> {errorMessage}</p>
            </div>
        {/if}
        <input required id="firstField" class="stagger-in textinput" type="email" bind:value={email} placeholder="your@address.com *" on:change={handleEmailSubmit} />
        <div class="stagger-in flex flex-col md:flex-row md:gap-4">
            <input required class="textinput" type="text" bind:value={firstName} placeholder="First Name *" />
            <input required class="textinput" type="text" bind:value={lastName} placeholder="Last Name *" />
        </div>
        <div class="stagger-in flex flex-col md:flex-row md:gap-4">
            <input required class="textinput" type="text" bind:value={company} placeholder="Company *" />
            <input required class="textinput" type="text" bind:value={title} placeholder="Title *" />
        </div>
        <textarea required class="stagger-in h-60 textinput" bind:value={message} placeholder="Your introductory message..."></textarea>
        <button type="submit" class='button stagger-in'>
            Send
            {#if loading}
                <span class="spinner"></span>
            {/if}
        </button>
    </form>

    {:else if step === 'otp'}
    <form in:fade={{ duration: 400 }} on:submit|preventDefault={handleOtpSubmit}>
        {#if errorMessage}
            <div class="text-lg text-center px-12 py-6 rounded-2xl bg-red-100 dark:bg-red-950 text-red-900 dark:text-white mb-6" in:fade={{ duration: 300 }}>
                <p><span class="font-bold">OOPS. </span> {errorMessage}</p>
            </div>
        {:else if alertMessage}
            <div class="text-lg text-center px-12 py-6 rounded-2xl bg-lime-100 dark:bg-lime-950 text-lime-900 dark:text-white mb-6" in:fade={{ duration: 300 }}>
                <p>{alertMessage}</p>
                <p><span class="font-bold">Check your email</span> for your OTP code.</p>
            </div>
        {/if}
        <input required autofocus class="textinput text-center" type="text" bind:value={otp} placeholder="Enter OTP code" />
        <button type="submit" class='button'>
            Verify
            {#if loading}
                <span class="spinner"></span>
            {/if}
        </button>
    </form>

    {:else if step === 'logged-in'}
    <form in:fade={{ duration: 400 }} on:submit|preventDefault={handleSupplementSubmit}>
        {#if alertMessage}
            <div class="text-lg text-center px-12 py-6 rounded-2xl bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-white mb-6" in:fade={{ duration: 300 }}>
                <p>{alertMessage}</p>
            </div>
        {/if}
        <!--thank you alert -->
        <div class="text-lg text-center px-12 py-6 rounded-2xl bg-lime-100 dark:bg-lime-950 text-lime-900 dark:text-white mb-6">
            <p><span class="font-bold">{firstName}</span>, thank you for reaching out to us. <br>You may edit the details that you've sent us below, or send us another message.</p>
        </div>

        <input class="textinput" type="email" bind:value={email} placeholder="your@address.com *" disabled />
        <div class="flex flex-col md:flex-row md:gap-4">
            <input class="textinput" type="text" bind:value={firstName} placeholder="First Name *" />
            <input class="textinput" type="text" bind:value={lastName} placeholder="Last Name *" />
        </div>
        <div class="flex flex-col md:flex-row md:gap-4">
            <input class="textinput" type="text" bind:value={company} placeholder="Company *" />
            <input class="textinput" type="text" bind:value={title} placeholder="Title *" />
        </div>
        <textarea class="h-60 textinput" bind:value={message} placeholder="Your supplementary message..."></textarea>
        <button type="submit" class="button">
            Send
            {#if loading}
                <span class="spinner"></span>
            {/if}
        </button>
    </form>
    {/if}
</div>
