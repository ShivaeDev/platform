import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { appViteConfig } from "@shivaedev/quality/appViteConfig.ts";

export default appViteConfig([tailwindcss(), react()], ["source"]);
