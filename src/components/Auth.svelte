<script>
import { authentication, createDirectus, rest } from "@directus/sdk";

const client = createDirectus('https://admin.urikabioworks.com').with(authentication()).with(rest());
const authToken = typeof window != 'undefined' ? window?.localStorage.getItem('publications.access_token') : undefined
const user = typeof window != 'undefined' ? window?.localStorage.getItem('publications.user') : undefined
const randomPassword = (length=12) => Math.random().toString(20)

if (authToken) {
    client.setToken(authToken)
}

async function handleSubmit(event) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const formData = new FormData(formEl);
    // Convert FormData to a simple JS object
    const data = Object.fromEntries(formData.entries());

    // Now POST JSON to your Flow
    const res = await fetch('https://admin.urikabioworks.com/flows/trigger/91684db5-7bdb-47dd-8255-d6d7f1d7bea4', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
  }
</script>

{#if authToken}
    <p>Welcome back, {user}</p>
{:else}
    <form on:submit={handleSubmit}>
        <input type="text" name="first_name" placeholder="First Name">
        <input type="email" name="email" placeholder="email@address.com">
        <input type="hidden" name="password" value={randomPassword()}>
        <button type="submit">Login</button>
    </form>
{/if}
