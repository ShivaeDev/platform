import { Cause, Exit, Schema } from "effect";
import { expect } from "vitest";
import { Conflict, InternalServerError, ServiceUnavailable } from "#errors/taxonomy.ts";
import { boundaryPolicy, boundaryStory } from "#test/rpc/boundaryStory.ts";

const Rejection = Schema.Union([Conflict, InternalServerError, ServiceUnavailable]);
boundaryStory.it("passes declared errors through with their identity and keeps success values", [], function* ({ succeed, reject }) {
	const conflict = new Conflict({ field: "name", message: "Name is taken" });
	expect(yield* reject(conflict)).toBe(conflict);
	expect(yield* succeed("saved")).toBe("saved");
});
boundaryStory.it("normalizes unexpected failures and defects while retaining their original cause off the wire", [], function* ({ fail }) {
	const original = new Error("database password=private-value");
	for (const defect of [false, true]) {
		const rejection = yield* fail(original, defect);
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
boundaryStory.it(
	"redacts a supplied public message and can use another declared fallback",
	[
		boundaryPolicy(ServiceUnavailable, {
			message: "Upstream failed with token=private-value",
			unexpected: (message) => new ServiceUnavailable({ message }),
		}),
	],
	function* ({ fail }) {
		const rejection = yield* fail("private failure");
		expect(rejection).toBeInstanceOf(ServiceUnavailable);
		expect(rejection.message).toBe("Upstream failed with token=<redacted>");
	},
);
boundaryStory.it("keeps interruption in the cause instead of turning it into a rejection", [], function* ({ interrupt }) {
	const exit = yield* interrupt();
	expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
});
boundaryStory.it("keeps interruption when an unexpected failure accompanies cancellation", [], function* ({ failCause }) {
	const original = Cause.fromReasons([...Cause.fail("cleanup failure").reasons, ...Cause.interrupt(42).reasons]);
	const exit = yield* failCause(original);
	if (!Exit.isFailure(exit)) {
		throw new Error("Expected an interrupted failure");
	}
	expect(Cause.hasInterrupts(exit.cause)).toBe(true);
	const reason = exit.cause.reasons.find(Cause.isFailReason);
	expect(reason?.error).toBeInstanceOf(InternalServerError);
	expect(reason?.error.cause).toBe(original);
});
