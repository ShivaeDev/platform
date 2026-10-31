import { createServer } from "node:http";
import { Effect, Schema } from "effect";
import { createViteServer } from "vitest/node";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appViteConfig } from "#appViteConfig.ts";

const HostRecord = Schema.fromJsonString(Schema.Struct({ host: Schema.String, path: Schema.String }));

interface Answer {
	readonly body: string;
	readonly status: number;
}

interface DevelopmentEngine {
	answer: Answer | undefined;
	readonly origin: string;
}

function forwarded(answer: Answer | undefined) {
	if (answer === undefined) {
		throw new Error("Request a path through Vite before reading what the application host received");
	}
	return answer.status === 200 ? Schema.decodeUnknownSync(HostRecord)(answer.body) : `not forwarded: Vite answered HTTP ${answer.status}`;
}

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
		const engine: DevelopmentEngine = { answer: undefined, origin };
		return engine;
	},
	inspect: ({ answer, origin }) => ({ answer, origin }),
	name: "Vite development proxy",
	stages: [],
	verbs: (engine, story) => ({
		hostReceived: () => Effect.sync(() => forwarded(engine.answer)),
		requests: (path: string) =>
			Effect.promise(async () => {
				story.tell(`the browser requests ${path} from Vite`);
				const response = await fetch(new URL(path, engine.origin));
				engine.answer = { body: await response.text(), status: response.status };
			}),
		viteHost: () => Effect.sync(() => new URL(engine.origin).host),
	}),
});
