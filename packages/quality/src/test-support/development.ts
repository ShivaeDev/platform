import { createServer } from "node:http";
import { Effect } from "effect";
import { createViteServer } from "vitest/node";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appViteConfig } from "#appViteConfig.ts";

export const development = storyKit({
	clock: "live",
	*create() {
		const host = createServer((request, response) => {
			response.setHeader("content-type", "application/json");
			response.end(JSON.stringify({ host: request.headers.host, path: request.url }));
		});
		yield* Effect.acquireRelease(
			Effect.promise(() => new Promise<void>((resolve) => host.listen(3000, "127.0.0.1", resolve))),
			() => Effect.promise(() => new Promise<void>((resolve, reject) => host.close((error) => (error ? reject(error) : resolve())))),
		);
		const config = appViteConfig([], [], ["/health"]);
		const vite = yield* Effect.acquireRelease(
			Effect.promise(() => createViteServer({ ...config, configFile: false, server: { ...config.server, port: 0, watch: null } })),
			(server) => Effect.promise(() => server.close()),
		);
		yield* Effect.promise(() => vite.listen());
		const origin = vite.resolvedUrls?.local[0];
		if (origin === undefined) {
			throw new Error("Vite has no listening URL");
		}
		return { origin };
	},
	name: "Vite development proxy",
	stages: [],
	verbs: (engine, story) => ({
		origin: () => engine.origin,
		request: (path: string) =>
			Effect.promise(async () => {
				story.tell(`request ${path} through Vite`);
				const response = await fetch(new URL(path, engine.origin));
				return { body: await response.text(), status: response.status };
			}),
	}),
});
