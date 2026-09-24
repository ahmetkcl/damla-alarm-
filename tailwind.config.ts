import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10213a",
        aqua: "#38a9a0",
        mist: "#e7f4f2",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(16, 33, 58, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
