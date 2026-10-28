import { expect } from "vitest";
import { isSensitiveKey } from "@shivaedev/errors/sensitive.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { tracePolicy, tracing } from "#test/rpc/tracingStory.ts";

const REDACTED_REGISTRATION = {
	devices: [{ name: "phone", refreshToken: "<redacted>" }],
	email: "alice@example.test",
	note: "<redacted>",
	password: "<redacted>",
	profile: { apiKey: "<redacted>", nickname: "alice" },
};

tracing.it("a caller's request id reaches the handler", [], function* ({ echo }) {
	expect(yield* echo("trace-7f3a")).toBe("trace-7f3a");
});

tracing.it("a caller's request id annotates the handler's logs", [], function* ({ echo, echoLogs }) {
	yield* echo("trace-7f3a");

	expect(yield* echoLogs()).toEqual([{ requestId: "trace-7f3a", "rpc.method": "Echo" }]);
});

tracing.it("a caller's request id annotates the RPC server span", [], function* ({ echo, serverSpanAttributes }) {
	yield* echo("trace-7f3a");

	expect(yield* serverSpanAttributes()).toEqual([{ "request.id": "trace-7f3a", "rpc.method": "Echo" }]);
});

for (const [reason, requestId] of [
	["no request id", undefined],
	["a request id with whitespace", "has spaces\nand newline"],
	["a request id longer than 128 characters", "x".repeat(129)],
] as const) {
	tracing.it(`a request with ${reason} gets a generated request id`, [], function* ({ echo }) {
		expect(yield* echo(requestId)).toBe("generated id 1");
	});
}

tracing.it("each request without a request id gets its own generated id", [], function* ({ echo }) {
	expect(yield* echo()).toBe("generated id 1");

	expect(yield* echo()).toBe("generated id 2");
});

tracing.it(
	"an app-chosen request id header carries the caller's id",
	[tracePolicy("the app reads request ids from x-correlation-id", { header: "x-correlation-id" })],
	function* ({ echo }) {
		expect(yield* echo("accepted-id", "x-correlation-id")).toBe("accepted-id");
	},
);

tracing.it("a declared field rejection reaches the caller as a conflict on the email field", [], function* ({ register, rejection }) {
	yield* register();

	expect(yield* rejection()).toBe("Conflict on email: Email already registered");
});

tracing.it("a declared rejection is logged once as an RPC failure tagged with its type and method", [], function* ({ failureLogs, register }) {
	yield* register();

	expect(yield* failureLogs()).toEqual([{ failure: "Conflict", method: "Register" }]);
});

tracing.it("the RPC failure log carries the payload with its secrets redacted", [], function* ({ failureLogPayloads, register }) {
	yield* register();

	expect(yield* failureLogPayloads()).toEqual([REDACTED_REGISTRATION]);
});

tracing.it("the RPC defect log carries the payload with its secrets redacted", [], function* ({ crash, defectLogs }) {
	yield* crash();

	expect(yield* defectLogs()).toEqual([{ method: "Crash", payload: REDACTED_REGISTRATION }]);
});

tracing.it("no log annotation carries a plaintext secret from a rejected or crashed call", [], function* ({ crash, register, secretsInLogs }) {
	yield* register();
	yield* crash();

	expect(yield* secretsInLogs()).toEqual([]);
});

tracing.it(
	"an app that also treats email as sensitive gets it redacted in the failure log",
	[tracePolicy("the app also treats email as sensitive", { sensitive: (key) => isSensitiveKey(key) || key === "email" })],
	function* ({ failureLogPayloads, register }) {
		yield* register();

		expect(yield* failureLogPayloads()).toEqual([{ ...REDACTED_REGISTRATION, email: "<redacted>" }]);
	},
);

tracing.it("an untagged external failure reaches the caller as its own value", [], function* ({ externalRejection }) {
	expect(yield* externalRejection()).toBe("upstream rate limit");
});

tracing.it("an untagged external failure is logged once as an unknown RPC failure", [], function* ({ externalRejection, failureLogs }) {
	yield* externalRejection();

	expect(yield* failureLogs()).toEqual([{ failure: "unknown", method: "ExternalRejection" }]);
});

tracing.it("a cancelled request stays interrupted", [], function* ({ cancel }) {
	expect(yield* cancel()).toBe("interrupted");
});

tracing.it("a cancelled request logs neither an RPC failure nor a defect", [], function* ({ cancel, defectLogs, failureLogs }) {
	yield* cancel();

	yield* outcomes({
		"defect logs": [defectLogs(), []],
		"failure logs": [failureLogs(), []],
	});
});
