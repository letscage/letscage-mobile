/** @type {import('tailwindcss').Config} */

const konstaConfig = require('konsta/config');

// wrap your config with konstaConfig
module.exports = konstaConfig({
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
})