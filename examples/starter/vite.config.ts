import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { appViteConfig } from "@shivaedev/build/appViteConfig.ts";

export default appViteConfig([tailwindcss(), react()], ["@shivaedev/source"], ["/auth/confirm", "/health"]);
