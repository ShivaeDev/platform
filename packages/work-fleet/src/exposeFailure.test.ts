import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { BadRequest, Conflict, Forbidden, NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { StorageAdmission, StorageConflict } from "#storage/errors.ts";
import { failureStory } from "#test/failureStory.ts";

for (const [name, error] of [
	["bad request", new BadRequest({ field: "message", message: "Invalid input" })],
	["conflict", new Conflict({ field: "revision", message: "Revision changed" })],
	["forbidden", new Forbidden({ message: "Approval required" })],
	["not found", new NotFound({ message: "Unknown work" })],
	["unavailable", new ServiceUnavailable({ message: "Provider unavailable" })],
] as const) {
	failureStory.it(
		`a ${name} failure reaches the client and the daemon client unchanged, keeps its automation owner and hides that owner from serialization`,
		[],
		function* ({ boundaryFailureOf, daemonErrorOf, ownerOf, requestFailure, serializedOwner }) {
			withFailureContext(error, { attentionOwner: "automation" });

			const received = yield* requestFailure(Effect.fail(error));

			expect(received).toEqual(error);
			yield* outcomes([
				["boundary failure", () => boundaryFailureOf(error), "the original error"],
				["daemon error", () => daemonErrorOf(error), "the original error"],
				["attention owner", () => ownerOf(error), "automation"],
				["serialized error", () => serializedOwner(error), "attention owner hidden"],
			]);
		},
	);
}

failureStory.it("an unclassified error belongs to the orchestrator", [], function* ({ ownerOf }) {
	expect(yield* ownerOf(new Error("Unclassified"))).toBe("orchestrator");
});

for (const [failure, error, expected] of [
	[
		"a storage conflict",
		new StorageConflict({ actualVersion: 2, expectedVersion: 1, workId: "one" }),
		"conflict: Work changed during this observation; load the current record",
	],
	["a refused admission", new StorageAdmission({ message: "Area occupied" }), "forbidden: Area occupied"],
	["a defect", undefined, "unavailable: The integration is unavailable; inspect runtime diagnostics"],
] as const) {
	failureStory.it(`${failure} reaches the client as ${expected.split(":")[0]}`, [], function* ({ requestOutcome }) {
		const outcome = yield* requestOutcome(error === undefined ? Effect.die("Unexpected failure") : Effect.fail(error));

		expect(outcome).toBe(expected);
	});
}

failureStory.it("an interruption passes the error boundary as an interruption", [], function* ({ interruptBoundary }) {
	const outcome = yield* interruptBoundary();

	expect(outcome).toBe("interrupted");
});
