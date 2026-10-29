import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { appViteConfig } from "@shivaedev/quality/appViteConfig.ts";

const config = appViteConfig([tailwindcss(), react()], ["source"]);
export default { ...config, server: { ...config.server, proxy: { ...config.server.proxy, "/rpc": { ...config.server.proxy["/rpc"], ws: true } } } };
