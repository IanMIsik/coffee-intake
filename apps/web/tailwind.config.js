/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
      },
      colors: {
        // The "coffee" scale keeps its old name but now maps to the estate palette:
        // 50 page background, 100 soft tint, 400 muted text, 600 primary green, 700 deep green, 900 ink.
        coffee: {
          50: "#f6f2ea",
          100: "#e4eee7",
          200: "#cfe0d5",
          300: "#e8e0d3",
          400: "#7b7266",
          500: "#3f7d5a",
          600: "#2b6a4b",
          700: "#1d4d36",
          800: "#143726",
          900: "#1f1b16",
        },
        cherry: {
          50: "#fdf0ee",
          100: "#fadad5",
          500: "#d0493a",
          600: "#b73a2c",
          700: "#962d22",
        },
        gold: { 100: "#f8ecc9", 500: "#c8962e", 700: "#8a6414" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(31,27,22,0.04), 0 4px 16px rgba(31,27,22,0.06)",
        pop: "0 10px 30px rgba(31,27,22,0.14)",
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem" },
    },
  },
  plugins: [],
};
