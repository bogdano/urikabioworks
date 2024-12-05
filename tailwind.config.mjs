/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
  		colors: {
        'urika-blue': {
          '50': '#f1f9fe',
          '100': '#e2f2fc',
          '200': '#bfe5f8',
          '300': '#87d1f2',
          '400': '#47b9e9',
          '500': '#27a9e0',
          '600': '#1181b8',
          '700': '#0f6795',
          '800': '#11577b',
          '900': '#144966',
          '950': '#0d2f44',
        },
        'urika-orange': {
          '50': '#fff9ed',
          '100': '#fef2d6',
          '200': '#fde2ab',
          '300': '#fbcc76',
          '400': '#f8ab3f',
          '500': '#f6931d',
          '600': '#e7760f',
          '700': '#bf5a0f',
          '800': '#984714',
          '900': '#7b3c13',
          '950': '#421c08',
        },
        'urika-gray': {
          '50': '#f5f5f6',
          '100': '#e6e6e7',
          '200': '#d0d0d1',
          '300': '#afb0b1',
          '400': '#808184',
          '500': '#6b6c6f',
          '600': '#5b5c5f',
          '700': '#4e4f50',
          '800': '#444446',
          '900': '#3c3c3d',
          '950': '#252527',
        },
  		},
		},
	},
	plugins: [],
}
