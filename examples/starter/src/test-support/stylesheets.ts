import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { build, createServer } from "vite";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

export const stylesheets = storyKit({
	clock: "live",
	create: () => ({ css: "" }),
	name: "application stylesheets",
	stages: [],
	verbs: (engine, { tell }) => ({
		*compile(mode: "development" | "production") {
			tell(`compile the application's ${mode} stylesheet`);
			if (mode === "development") {
				const server = yield* Effect.acquireRelease(
					Effect.promise(() => createServer({ configLoader: "native", logLevel: "silent", root, server: { middlewareMode: true } })),
					(acquired) => Effect.promise(() => acquired.close()),
				);
				const result = yield* Effect.promise(() => server.transformRequest("/src/client/entry.css?direct"));
				if (result === null) {
					throw new Error("The application stylesheet was not served");
				}
				engine.css = result.code;
			} else {
				const result = yield* Effect.promise(() =>
					build({ build: { rolldownOptions: { input: "src/client/entry.css" }, write: false }, configLoader: "native", logLevel: "silent", root }),
				);
				const outputs = Array.isArray(result) ? result : [result];
				engine.css = outputs
					.flatMap((output) => ("output" in output ? output.output : []))
					.flatMap((file) => (file.type === "asset" && file.fileName.endsWith(".css") ? [file.source.toString()] : []))
					.join("\n");
			}
		},
		css: () => engine.css,
	}),
});
