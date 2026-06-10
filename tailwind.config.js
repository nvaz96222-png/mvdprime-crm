/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Identidad MVDPrime
        navy: {
          DEFAULT: "#1A2B4A",
          dark: "#14223b",
          light: "#243a61",
          lighter: "#2e4a7a",
        },
        accent: {
          DEFAULT: "#0D7377",
          dark: "#0a5a5d",
          light: "#0fa3a8",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
