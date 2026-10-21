import { inspect } from "node:util";
import { Cause, ErrorReporter, Exit } from "effect";
import { expect } from "vitest";
import { redactDefect } from "#server/rpc-server/redactCause.ts";
import { redaction } from "#test/rpc/redaction.ts";

redaction.it("stackless ignored external errors keep their reporting policy after redaction", [], function* ({ report }) {
	const original = new Error("password=ignored-secret");
	Object.defineProperty(original, ErrorReporter.ignore, { value: true });
	delete original.stack;
	const copy = redactDefect(original);
	expect(copy).toBeInstanceOf(Error);
	expect(copy).toMatchObject({ message: "password=<redacted>", stack: undefined });
	expect(ErrorReporter.isIgnored(copy)).toBe(true);
	const reports = yield* report(original);
	expect(reports).toEqual([]);
});
redaction.it("defect logs keep the error's shape but redact its fields and cause", [], function* ({ crash, logs }) {
	yield* crash("object");
	yield* crash("error");
	const defects = logs().filter((log) => log.level === "Error");
	expect(defects).toHaveLength(2);
	expect(inspect(defects, { depth: 20 })).not.toMatch(/hunter2-plaintext|key-plaintext|token-plaintext/u);
	expect(defects.map((log) => log.annotations["rpc.defect"])).toEqual([
		[{ detail: "object defect", password: "<redacted>" }],
		[expect.objectContaining({ apiKey: "<redacted>", cause: { reason: "nested", token: "<redacted>" }, message: "leaky defect", name: "Error" })],
	]);
});
redaction.it("provider failures are logged without credential fields", [], function* ({ providerFailure, logs }) {
	yield* providerFailure();
	const [failure] = logs().filter((log) => log.level === "Error");
	expect(inspect(failure?.message, { depth: 20 })).toContain("database closed");
	expect(inspect(logs(), { depth: 20 })).not.toContain("cookie-plaintext");
});
redaction.it("the cause seen by the client, error reporters and the server span has redacted defects", [], function* ({ crash, spans, reported }) {
	const exits = [yield* crash("object"), yield* crash("error")];
	expect(reported()).toHaveLength(2);
	expect(inspect(reported(), { depth: 20 })).not.toMatch(/hunter2-plaintext|key-plaintext|token-plaintext/u);
	expect(inspect(exits, { depth: 20 })).not.toMatch(/hunter2-plaintext|key-plaintext|token-plaintext/u);
	const serverSpans = spans().filter((span) => span.kind === "server" && span.name === "Crash");
	expect(serverSpans).toHaveLength(2);
	expect(
		inspect(
			serverSpans.map((span) => [span.status, span.events, span.attributes]),
			{ depth: 20 },
		),
	).not.toMatch(/hunter2-plaintext|key-plaintext|token-plaintext/u);
	const [objectExit, errorExit] = exits;
	expect(objectExit !== undefined && Exit.isFailure(objectExit) && Cause.squash(objectExit.cause)).toEqual({
		detail: "object defect",
		password: "<redacted>",
	});
	const defect = errorExit !== undefined && Exit.isFailure(errorExit) ? Cause.squash(errorExit.cause) : undefined;
	expect(defect).toBeInstanceOf(Error);
	expect(defect).toMatchObject({ apiKey: "<redacted>", cause: { reason: "nested", token: "<redacted>" }, message: "leaky defect" });
});
redaction.it("a redacting error reporter hands the wrapped reporter a redacted cause with the same reporting hints", [], function* ({ report }) {
	const defect = Object.assign(new Error("login failed for password=hunter2-plaintext"), {
		[ErrorReporter.severity]: "Error",
		[ErrorReporter.attributes]: { apiKey: "key-plaintext", userId: "u1" },
	});
	const reports = yield* report(defect);
	expect(inspect(reports, { depth: 20 })).not.toMatch(/hunter2-plaintext|key-plaintext/u);
	expect(reports).toEqual([
		{
			attributes: { apiKey: "<redacted>", userId: "u1" },
			error: expect.objectContaining({ message: "login failed for password=<redacted>" }),
			severity: "Error",
		},
	]);
});
