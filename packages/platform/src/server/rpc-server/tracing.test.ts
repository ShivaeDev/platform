import { Cause, Exit, Option } from "effect";
import { expect } from "vitest";
import { rejectedField } from "@shivaedev/contract/errors/rejectedField.ts";
import { Conflict } from "@shivaedev/contract/errors/taxonomy.ts";
import { isSensitiveKey } from "#server/rpc-server/sensitive.ts";
import { tracePolicy, tracing } from "#test/rpc/tracingStory.ts";

tracing.it("a caller's request id reaches handlers, log annotations and the RPC server span", [], function* ({ echo, annotations, spans }) {
	const value = yield* echo({ "x-request-id": "trace-7f3a" });
	expect(value).toBe("trace-7f3a");
	expect(annotations("echo")).toEqual([{ requestId: "trace-7f3a", "rpc.method": "Echo" }]);
	const span = spans().find((candidate) => candidate.kind === "server" && candidate.name === "Echo");
	expect(Object.fromEntries(span?.attributes ?? [])).toMatchObject({ "request.id": "trace-7f3a", "rpc.method": "Echo" });
});
tracing.it("missing or malformed request ids are replaced with generated ones", [tracePolicy({ header: "x-correlation-id" })], function* ({ echo }) {
	const value: string[] = [];
	for (const headers of [
		{},
		{ "x-correlation-id": "has spaces\nand newline" },
		{ "x-correlation-id": "x".repeat(129) },
		{ "x-correlation-id": "accepted-id" },
	]) {
		value.push(yield* echo(headers));
	}
	expect(value.slice(0, 3)).toEqual(Array.from({ length: 3 }, () => expect.stringMatching(/^[0-9a-f]{32}$/u)));
	expect(new Set(value.slice(0, 3)).size).toBe(3);
	expect(value[3]).toBe("accepted-id");
});
tracing.it(
	"failure logs carry a redacted payload while the declared field rejection reaches the caller",
	[],
	function* ({ register, crash, annotations, logs }) {
		const rejection = yield* register();
		yield* crash();
		expect(rejection).toBeInstanceOf(Conflict);
		expect(rejectedField(rejection)).toEqual(Option.some({ field: "email", message: "Email already registered" }));
		const [failure] = annotations("RPC failure");
		expect(failure).toMatchObject({ "rpc.failure": "Conflict", "rpc.method": "Register" });
		expect(failure?.["rpc.payload"]).toEqual({
			devices: [{ name: "phone", refreshToken: "<redacted>" }],
			email: "alice@example.test",
			note: "<redacted>",
			password: "<redacted>",
			profile: { apiKey: "<redacted>", nickname: "alice" },
		});
		const defect = logs().find((log) => log.level === "Error");
		expect(defect?.annotations).toMatchObject({ "rpc.method": "Crash", "rpc.payload": failure?.["rpc.payload"] });
		const serialized = JSON.stringify(logs().map((log) => log.annotations));
		for (const secret of ["hunter2", "key-plaintext", "refresh-plaintext", "note-plaintext"]) {
			expect(serialized).not.toContain(secret);
		}
	},
);
tracing.it(
	"applications extend the sensitive-key policy",
	[tracePolicy({ sensitive: (key) => isSensitiveKey(key) || key === "email" })],
	function* ({ register, annotations }) {
		yield* register();
		expect(annotations("RPC failure")[0]?.["rpc.payload"]).toMatchObject({ email: "<redacted>", password: "<redacted>" });
	},
);
tracing.it("untagged external failures reach the caller and are logged once as unknown", [], function* ({ externalRejection, annotations }) {
	const value = yield* externalRejection();
	expect(value).toBe("upstream rate limit");
	expect(annotations("RPC failure")).toEqual([expect.objectContaining({ "rpc.failure": "unknown", "rpc.method": "ExternalRejection" })]);
});
tracing.it("request cancellation remains interrupted without producing a failure log", [], function* ({ cancel, annotations }) {
	const exit = yield* cancel();
	expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
	expect(annotations("RPC failure")).toEqual([]);
	expect(annotations("RPC defect")).toEqual([]);
});
