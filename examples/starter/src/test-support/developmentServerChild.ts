import { writeSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createServer, type Plugin } from "vite";

const target = new URL(process.argv[2] ?? "").origin;
const backend: Plugin = {
	configResolved(config) {
		for (const proxy of Object.values(config.server.proxy ?? {})) {
			if (typeof proxy !== "string") {
				proxy.target = target;
			}
		}
	},
	name: "story-backend",
};
const server = await createServer({
	...(process.argv[3] ? { configFile: process.argv[3] } : {}),
	plugins: [backend],
	root: fileURLToPath(new URL("../../", import.meta.url)),
	server: { port: 0, strictPort: false },
});
await server.listen();
writeSync(3, `${new URL(server.resolvedUrls?.local[0] ?? "").origin}\n`);
