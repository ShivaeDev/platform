import { expect } from "@effect/vitest";
import { Cause, Effect } from "effect";
import { BadRequest, Conflict, Forbidden, NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { failureContext, withFailureContext } from "#engine/failureContext.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import { daemonError } from "#host/daemonClient.ts";
import { StorageAdmission, StorageConflict } from "#storage/errors.ts";
import { failureStory } from "#test/failureStory.ts";

failureStory.it("preserves platform errors and internal attention ownership before serialization", [], function* ({ request, mappedFailure }) {
	for (const error of [
		new BadRequest({ field: "message", message: "Invalid input" }),
		new Conflict({ field: "revision", message: "Revision changed" }),
		new Forbidden({ message: "Approval required" }),
		new NotFound({ message: "Unknown work" }),
		new ServiceUnavailable({ message: "Provider unavailable" }),
	]) {
		withFailureContext(error, { attentionOwner: "automation" });
		expect(yield* request(Effect.fail(error)).pipe(Effect.flip)).toEqual(error);
		expect(mappedFailure()).toBe(error);
		expect(daemonError(error, 12_345)).toBe(error);
		expect(failureOwner(error)).toBe("automation");
		expect(JSON.stringify(error)).not.toContain("attentionOwner");
	}
	expect(failureContext(new Error("Unclassified"))).toEqual({});
	expect(failureOwner(new Error("Unclassified"))).toBe("orchestrator");
});

failureStory.it("maps storage conflicts and admission failures without losing their meaning", [], function* ({ request }) {
	expect(yield* request(Effect.fail(new StorageConflict({ actualVersion: 2, expectedVersion: 1, workId: "one" }))).pipe(Effect.flip)).toMatchObject({
		_tag: "Conflict",
		message: "Work changed during this observation; load the current record",
	});
	expect(yield* request(Effect.fail(new StorageAdmission({ message: "Area occupied" }))).pipe(Effect.flip)).toMatchObject({
		_tag: "Forbidden",
		message: "Area occupied",
	});
});

failureStory.it("keeps defects out of transport errors and leaves interruption intact", [], function* ({ request, interrupt }) {
	const defect = yield* request(Effect.die("Unexpected failure")).pipe(Effect.flip);
	expect(defect).toMatchObject({ _tag: "ServiceUnavailable", message: "The integration is unavailable; inspect runtime diagnostics" });
	const interrupted = yield* interrupt().pipe(Effect.exit);
	expect(interrupted._tag).toBe("Failure");
	if (interrupted._tag === "Failure") {
		expect(Cause.hasInterruptsOnly(interrupted.cause)).toBe(true);
	}
});
