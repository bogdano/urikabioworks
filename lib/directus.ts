import { createDirectus, rest, } from '@directus/sdk';

type Global = {
  title: string;
  seo_description: string;
}

// type Author = {
//   name: string
// }

type Page = {
  title: string;
  permalink: string;
  seo_description: string;
  status: string;
}

// type Post = {
//   image: string;
//   title: string;
//   author: Author;
//   content: string;
//   published_date: string
//   slug: string;
// }

type Schema = {
  // posts: Post[];
  global: Global;
  pages: Page[];
}

const directus = createDirectus('https://admin.urikabioworks.com').with(rest());

export default directus;
