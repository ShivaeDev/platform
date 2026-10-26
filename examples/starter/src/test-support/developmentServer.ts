import { Effect } from "effect";
import { createServer, type Plugin } from "vite";

export const developmentServer = Effect.fn("AppStory.developmentServer")(function* (target: string) {
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
	const server = yield* Effect.acquireRelease(
		Effect.promise(() =>
			createServer({
				plugins: [backend],
				server: { port: 0, strictPort: false },
			}),
		),
		(running) => Effect.promise(() => running.close()),
	);
	yield* Effect.promise(() => server.listen());
	return new URL(server.resolvedUrls?.local[0] ?? "").origin;
});
