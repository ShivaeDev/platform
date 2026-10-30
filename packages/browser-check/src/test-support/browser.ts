import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runCli } from "#test/runCli.ts";
import { startHost } from "#test/startHost.ts";

export const browser = storyKit({
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "browser-check-story-" });
		const host = yield* startHost;
		return { host, root };
	},
	layer: NodeServices.layer,
	name: "local browser check",
	stages: [],
	verbs: ({ root, host }, story) => ({
		run: (args: readonly string[] = [], credentials: Readonly<Record<string, string>> = {}) => {
			story.tell(`look at the running app: ${args.join(" ")}`);
			return runCli(root, host.url, args, credentials);
		},
		screenshot: (index: number) => readFileSync(join(root, ".browser-check", `${index}.png`)),
		signIns: () => host.signIns,
		visits: () => host.visits,
	}),
});
