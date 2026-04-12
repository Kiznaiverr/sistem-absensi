/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/frontend/**/*.{html,ts,js}"],
  theme: {
    extend: {
      colors: {
        // Custom color scheme
        cream: {
          50: "#fffef9",
          100: "#fff9f0",
          200: "#fff1d3",
          300: "#ffe5b0",
          400: "#ffc87d",
        },
        peach: {
          50: "#fff9f5",
          100: "#ffecdf",
          200: "#ffd9b8",
          300: "#ffb090",
          400: "#ff9a6a",
          500: "#ff7f42",
          600: "#ff6b1b",
          700: "#d44e0a",
        },
        mint: {
          50: "#f5fffe",
          100: "#d0f2eb",
          200: "#c0e1d2",
          300: "#a8d5c0",
          400: "#7ec0a0",
          500: "#5aa881",
          600: "#458a6f",
          700: "#356b59",
        },
        primary: {
          50: "#f5fffe",
          100: "#d0f2eb",
          200: "#c0e1d2",
          300: "#a8d5c0",
          500: "#5aa881",
          600: "#458a6f",
        },
        success: "#c0e1d2",
        warning: "#ffb090",
        error: "#ff6b1b",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".8" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-in",
        slideUp: "slideUp 0.3s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
