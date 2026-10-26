import { Cause, Effect, Exit, Schema } from "effect";
import { expect } from "vitest";
import { Conflict, InternalServerError, ServiceUnavailable } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { rpcBoundary } from "#server/rpc-server/boundary.ts";

const Rejection = Schema.Union([Conflict, InternalServerError, ServiceUnavailable]);
const boundary = rpcBoundary(Rejection, { unexpected: (message) => new InternalServerError({ message }) });

it.effect("passes declared errors through with their identity and keeps success values", function* () {
	const conflict = new Conflict({ field: "name", message: "Name is taken" });
	expect(yield* Effect.flip(boundary(Effect.fail(conflict)))).toBe(conflict);
	expect(yield* boundary(Effect.succeed("saved"))).toBe("saved");
});

it.effect("normalizes unexpected failures and defects while retaining their original cause off the wire", function* () {
	const original = new Error("database password=private-value");
	for (const operation of [Effect.fail(original), Effect.die(original)]) {
		const rejection = yield* Effect.flip(boundary(operation));
		expect(rejection).toBeInstanceOf(InternalServerError);
		expect(rejection.message).toBe("Internal server error");
		expect(Cause.isCause(rejection.cause)).toBe(true);
		if (!Cause.isCause(rejection.cause)) {
			throw new Error("Expected original Effect cause");
		}
		expect(Cause.squash(rejection.cause)).toBe(original);
		expect(Schema.encodeSync(Rejection)(rejection)).toEqual({ _tag: "InternalServerError", message: "Internal server error" });
	}
});

it.effect("redacts a supplied public message and can use another declared fallback", function* () {
	const fallback = rpcBoundary(ServiceUnavailable, {
		message: "Upstream failed with token=private-value",
		unexpected: (message) => new ServiceUnavailable({ message }),
	});
	const rejection = yield* Effect.flip(fallback(Effect.fail("private failure")));
	expect(rejection).toBeInstanceOf(ServiceUnavailable);
	expect(rejection.message).toBe("Upstream failed with token=<redacted>");
});

it.effect("keeps interruption in the cause instead of turning it into a rejection", function* () {
	const exit = yield* Effect.exit(boundary(Effect.interrupt));
	expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
});

it.effect("keeps interruption when an unexpected failure accompanies cancellation", function* () {
	const original = Cause.fromReasons([...Cause.fail("cleanup failure").reasons, ...Cause.interrupt(42).reasons]);
	const exit = yield* Effect.exit(boundary(Effect.failCause(original)));
	if (!Exit.isFailure(exit)) {
		throw new Error("Expected an interrupted failure");
	}
	expect(Cause.hasInterrupts(exit.cause)).toBe(true);
	const reason = exit.cause.reasons.find(Cause.isFailReason);
	expect(reason?.error).toBeInstanceOf(InternalServerError);
	expect(reason?.error.cause).toBe(original);
});
