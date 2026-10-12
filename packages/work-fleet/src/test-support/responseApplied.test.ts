import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Conflict, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { responseApplied } from "#test/responseApplied.ts";

it.live("recovery polling reloads stale observations and still waits for its exact response receipt", function* () {
	let observations = 0;
	let reloads = 0;
	const observe = Effect.suspend(() => {
		observations += 1;
		return observations === 1
			? Effect.fail(new Conflict({ message: "Work changed during this observation" }))
			: Effect.succeed({ responses: [{ boardAcknowledged: true, responseId: "answer" }] });
	});
	const refresh = Effect.sync(() => {
		reloads += 1;
		return { responses: [{ boardAcknowledged: true, responseId: "other-answer" }] };
	});
	yield* responseApplied(observe, refresh, "answer");
	expect(observations).toBe(2);
	expect(reloads).toBe(1);
});

it.live("recovery polling preserves unrelated failures without reloading", function* () {
	const failure = new ServiceUnavailable({ message: "Provider unavailable" });
	let reloads = 0;
	const refresh = Effect.sync(() => {
		reloads += 1;
		return { responses: [{ boardAcknowledged: true, responseId: "answer" }] };
	});
	expect(yield* responseApplied(Effect.fail(failure), refresh, "answer").pipe(Effect.flip)).toBe(failure);
	expect(reloads).toBe(0);
});

it.live("recovery polling waits for acknowledgement before returning a matching receipt", function* () {
	let observations = 0;
	const observe = Effect.sync(() => {
		observations += 1;
		return { responses: [{ boardAcknowledged: observations > 1, responseId: "answer" }] };
	});
	yield* responseApplied(observe, Effect.die("Unexpected reload"), "answer");
	expect(observations).toBe(2);
});
