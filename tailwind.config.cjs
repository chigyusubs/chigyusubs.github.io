/** @type {import('tailwindcss').Config} */
module.exports = {
  safelist: Array.from({ length: 101 }, (_, i) => `w-[${i}%]`),
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
