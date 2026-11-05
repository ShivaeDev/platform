import { Effect } from "effect";
import type { GitHubState } from "#initializeGitHub.ts";
import { User } from "#repositorySchemas.ts";
import { read } from "./read.ts";

export function getUser(state: GitHubState) {
	return Effect.fn("GitHub.getUser")(function* (username?: string, byteLimit?: number) {
		return yield* Effect.flatMap(read(state)(username === undefined ? "/user" : `/users/${encodeURIComponent(username)}`, byteLimit), (page) =>
			page.decode(User),
		);
	});
}
