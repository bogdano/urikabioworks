// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import netlify from "@astrojs/netlify";

import partytown from "@astrojs/partytown";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://urikabioworks.com",
  integrations: [
    tailwind(),
    partytown(),
    sitemap({
      filter: (page) => page !== "https://urikabioworks.com/thank-you",
    }),
  ],
  output: "static",
  adapter: netlify(),
  prefetch: true,
});
