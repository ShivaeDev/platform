import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readCommand } from "#host/readCommand.ts";
import { reportRepository } from "#host/reportPublication.ts";

export const reportRepositories = storyKit({
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const root = yield* fs.makeTempDirectoryScoped();
			yield* readCommand("git", ["init", "--quiet"], root);
			return { root };
		}),
	layer: NodeServices.layer,
	name: "Fleet report repository",
	stages: ["remote"],
	verbs: ({ root }, story) => ({
		read: () => {
			story.tell("read the report repository from the Git origin remote");
			return reportRepository(root, "origin");
		},
	}),
});

export function reportRemote(url: string) {
	return reportRepositories.trait("remote", `origin is ${url}`, ({ root }) => readCommand("git", ["remote", "add", "origin", url], root));
}
