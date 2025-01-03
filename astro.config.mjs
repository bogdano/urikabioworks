// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import netlify from "@astrojs/netlify";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";

// https://astro.build/config
export default defineConfig({
    site: "https://urikabioworks.com",
    integrations: [tailwind(), sitemap({
        filter: (page) => page !== "https://urikabioworks.com/thank-you",
    }), svelte()],
    output: "static",
    adapter: netlify(),
    prefetch: true,
    experimental: {
        clientPrerender: true,
    },
});
