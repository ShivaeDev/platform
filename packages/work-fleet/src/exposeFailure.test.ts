import { expect } from "@effect/vitest";
import { Cause, Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { BadRequest, Conflict, Forbidden, NotFound, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { failureContext, withFailureContext } from "#engine/failureContext.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import { daemonError } from "#host/daemonClient.ts";
import { StorageAdmission, StorageConflict } from "#storage/errors.ts";
import { exposeFailure } from "./exposeFailure.ts";

it.effect("preserves platform errors and internal attention ownership before serialization", function* () {
	for (const error of [
		new BadRequest({ field: "message", message: "Invalid input" }),
		new Conflict({ field: "revision", message: "Revision changed" }),
		new Forbidden({ message: "Approval required" }),
		new NotFound({ message: "Unknown work" }),
		new ServiceUnavailable({ message: "Provider unavailable" }),
	]) {
		withFailureContext(error, { attentionOwner: "automation" });
		expect(yield* exposeFailure(Effect.fail(error)).pipe(Effect.flip)).toBe(error);
		expect(daemonError(error, 12_345)).toBe(error);
		expect(failureOwner(error)).toBe("automation");
		expect(JSON.stringify(error)).not.toContain("attentionOwner");
	}
	expect(failureContext(new Error("Unclassified"))).toEqual({});
	expect(failureOwner(new Error("Unclassified"))).toBe("orchestrator");
});

it.effect("maps storage conflicts and admission failures without losing their meaning", function* () {
	expect(
		yield* exposeFailure(Effect.fail(new StorageConflict({ actualVersion: 2, expectedVersion: 1, workId: "one" }))).pipe(Effect.flip),
	).toMatchObject({ _tag: "Conflict", message: "Work changed during this observation; load the current record" });
	expect(yield* exposeFailure(Effect.fail(new StorageAdmission({ message: "Area occupied" }))).pipe(Effect.flip)).toMatchObject({
		_tag: "Forbidden",
		message: "Area occupied",
	});
});

it.effect("keeps defects out of transport errors and leaves interruption intact", function* () {
	const defect = yield* exposeFailure(Effect.die("Unexpected failure")).pipe(Effect.flip);
	expect(defect).toMatchObject({ _tag: "ServiceUnavailable", message: "The integration is unavailable; inspect runtime diagnostics" });
	const interrupted = yield* exposeFailure(Effect.interrupt).pipe(Effect.exit);
	expect(interrupted._tag).toBe("Failure");
	if (interrupted._tag === "Failure") {
		expect(Cause.hasInterruptsOnly(interrupted.cause)).toBe(true);
	}
});
