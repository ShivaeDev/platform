import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { resolveHost } from "#host/config.ts";
import type { GithubRead } from "#host/github.ts";
import { githubResult } from "#host/githubResult.ts";
import { MainSource, unchanged } from "#host/mainSource.ts";
import type { BoardWork } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";

export const HEAD = "a".repeat(40);
export const BASE = "b".repeat(40);
export const MOVED = "c".repeat(40);
export const PR = "https://github.com/example/repository/pull/7";
export const REPORT = `Reviewed changes.\nFLEET_HEAD: ${HEAD}\nFLEET_PR: ${PR}`;
export const NO_CHANGE = `Existing behavior satisfies the criteria.\nFLEET_HEAD: ${HEAD}\nFLEET_PR: none`;
export const work: BoardWork = {
	approved: true,
	context: "Synthetic work",
	dependsOn: [],
	revision: "board-v1",
	sourcePath: "task.md",
	workId: "task",
};
export function completed(output = REPORT): SessionObservation {
	return { execution: "completed", output, provisioning: "ready", receipt: { sessionId: "worker", turnId: "turn" } };
}

interface ResultOptions {
	readonly after?: Readonly<Record<string, unknown>>;
	readonly before?: Readonly<Record<string, unknown>>;
	readonly files?: unknown;
	readonly invalidJson?: boolean;
	readonly mainHead?: string;
	readonly unavailable?: boolean;
}
export function resultFixture(options: ResultOptions = {}) {
	const requests: (readonly string[])[] = [];
	let refreshes = 0;
	const snapshot = { observedAt: 1, revision: options.mainHead ?? HEAD };
	const main = MainSource.of({
		current: Effect.succeed({ ...snapshot, revision: BASE }),
		observe: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, snapshot)),
		refresh: Effect.sync(() => {
			refreshes += 1;
			return snapshot;
		}),
		repositoryRoot: "/synthetic",
	});
	const read = scriptedGithubRead(options, requests);
	const host = resolveHost("/synthetic/board", { provider: "local", result: "github" });
	return { adopt: githubResult(host, main, read), host, main, refreshes: () => refreshes, requests };
}

function scriptedGithubRead(options: ResultOptions, requests: (readonly string[])[]): GithubRead {
	let next = options.before;
	const pr = { base: { ref: "main", sha: BASE }, "changed_files": 2, head: { sha: HEAD }, "html_url": PR, merged: false, number: 7, state: "open" };
	const read: GithubRead = (args) =>
		Effect.suspend(() => {
			requests.push(args);
			if (options.unavailable) {
				return Effect.fail(new ServiceUnavailable({ message: "GitHub unavailable" }));
			}
			if (options.invalidJson) {
				return Effect.succeed("not json");
			}
			if (args[0] === "repo") {
				return Effect.succeed(JSON.stringify({ nameWithOwner: "example/repository" }));
			}
			if (args[1]?.includes("/files?")) {
				return Effect.succeed(JSON.stringify(options.files ?? [[{ filename: "src/one.ts" }], [{ filename: "src/two.ts" }]]));
			}
			const value = { ...pr, ...next };
			next = options.after;
			return Effect.succeed(JSON.stringify(value));
		});
	return read;
}
