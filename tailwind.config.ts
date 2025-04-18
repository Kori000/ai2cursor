import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        ripple: {
          "0%": {
            transform: "scale(2)",
            opacity: "0",
            boxShadow: "0px 0px 50px rgba(255, 255, 255, 0.5)",
          },
          "50%": {
            transform: "scale(1) translate(0px, -5px)",
            opacity: "1",
            boxShadow: "0px 8px 20px rgba(255, 255, 255, 0.5)",
          },
          "100%": {
            transform: "scale(0.1) translate(0px, 5px)",
            opacity: "0",
            boxShadow: "0px 10px 20px rgba(255, 255, 255, 0)",
          },
        },
      },
      animation: {
        ripple: "ripple 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
