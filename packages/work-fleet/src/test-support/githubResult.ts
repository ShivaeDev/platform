import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { resolveHost } from "#host/config.ts";
import type { GithubRead } from "#host/github.ts";
import { githubResult } from "#host/githubResult.ts";
import { MainSource, unchanged } from "#host/mainSource.ts";
import type { BoardWork } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";
import { changedPathRepository } from "#test/changedPathRepository.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

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
	readonly boardDir?: string;
	readonly files?: unknown;
	readonly invalidJson?: boolean;
	readonly mainHead?: string;
	readonly unavailable?: boolean;
	readonly verified?: Readonly<Record<string, unknown>>;
}

export const localResultFixture = Effect.fn("Test.localResultFixture")(function* (options: ResultOptions = {}) {
	const repository = yield* changedPathRepository(["src/one.ts", "src/two.ts"]);
	const snapshot = { base: { ref: "main", sha: repository.base }, "changed_files": 791, head: { sha: repository.head } };
	return {
		...resultFixture({
			...options,
			after: { ...snapshot, ...options.after },
			before: { ...snapshot, ...options.before },
			boardDir: repository.boardDir,
			verified: { ...snapshot, ...options.after, ...options.verified },
		}),
		head: repository.head,
	};
});
export function resultFixture(options: ResultOptions = {}) {
	const requests: string[] = [];
	let refreshes = 0;
	const snapshot = { observedAt: 1, revision: options.mainHead ?? HEAD };
	const main = MainSource.of({
		current: Effect.succeed({ ...snapshot, revision: BASE }),
		latest: Effect.succeed(snapshot),
		observe: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, snapshot)),
		refresh: Effect.sync(() => {
			refreshes += 1;
			return snapshot;
		}),
		repositoryRoot: "/synthetic",
	});
	const read = scriptedGithubRead(options, requests);
	const host = resolveHost(options.boardDir ?? "/synthetic/board", { database: syntheticDatabase, provider: "local", result: "github" });
	return { adopt: githubResult(host, read, Effect.succeed("example/repository")), host, main, refreshes: () => refreshes, requests };
}

function scriptedGithubRead(options: ResultOptions, requests: string[]): GithubRead {
	let observations = 0;
	const pr = { base: { ref: "main", sha: BASE }, "changed_files": 2, head: { sha: HEAD }, "html_url": PR, merged: false, number: 7, state: "open" };
	const snapshots = [options.before, options.after, options.verified ?? options.after];
	function read(endpoint: string) {
		return Effect.suspend(() => {
			requests.push(endpoint);
			if (options.unavailable) {
				return Effect.fail(new ServiceUnavailable({ message: "GitHub unavailable" }));
			}
			if (options.invalidJson) {
				return Effect.succeed("not json");
			}
			if (endpoint.includes("/files?")) {
				return Effect.succeed(JSON.stringify(options.files ?? [[{ filename: "src/one.ts" }], [{ filename: "src/two.ts" }]]));
			}
			const overrides = snapshots[Math.min(observations, snapshots.length - 1)];
			const value = { ...pr, ...overrides };
			observations += 1;
			return Effect.succeed(JSON.stringify(value));
		});
	}
	return { get: read, pages: read };
}
