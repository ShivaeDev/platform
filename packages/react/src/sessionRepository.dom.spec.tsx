import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { mountedSessions, sessionRepository } from "#test/session-repository/story.ts";

expectNoReactWarnings();

for (const mode of ["get", "compared"] as const) {
	sessionRepository.it(
		`a worker repository write refreshes alice's mounted ${mode} query and denies bob's revoked read over an authenticated PostgreSQL WebSocket`,
		[mountedSessions(mode)],
		function* ({ denyBob, reads, shown, workerWrites }) {
			yield* outcomes([
				["alice before", () => shown("alice"), "First"],
				["bob before", () => shown("bob"), "First"],
			]);
			const bobReads = yield* reads("bob");
			yield* denyBob();

			yield* workerWrites("Worker title");

			yield* outcomes([
				["alice after", () => shown("alice"), "Worker title"],
				["bob after", () => shown("bob"), "Read denied"],
				["bob's data reads", () => reads("bob"), bobReads],
			]);
			expect(bobReads).toEqual(["bob"]);
		},
	);
}
