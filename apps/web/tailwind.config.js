/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: "#f7f3ee",
          100: "#ede2d3",
          400: "#a9764a",
          600: "#7a4a26",
          700: "#5f3a1e",
          900: "#2e1a0e",
        },
      },
    },
  },
  plugins: [],
};
