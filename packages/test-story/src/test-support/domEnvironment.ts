import { fileURLToPath } from "node:url";

export const domEnvironment = { environment: fileURLToPath(new URL("../server/adapters/domEnvironment.config.ts", import.meta.url)) };
