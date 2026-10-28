import { ErrorReporter } from "effect";
import { expect } from "vitest";
import { redaction } from "#test/rpc/redaction.ts";

const redacted = {
	"an error defect": { apiKey: "<redacted>", cause: { reason: "nested", token: "<redacted>" }, error: "Error", message: "leaky defect" },
	"an object defect": { detail: "object defect", password: "<redacted>" },
} as const;

for (const kind of ["an error defect", "an object defect"] as const) {
	const expected = redacted[kind];
	redaction.it(`when a handler dies with ${kind}, the client sees it with its secrets redacted`, [], function* ({ crash, defectSeenByClient }) {
		yield* crash(kind);

		expect(yield* defectSeenByClient()).toEqual([expected]);
	});

	redaction.it(`when a handler dies with ${kind}, the error reporter gets it with its secrets redacted`, [], function* ({ crash, defectReported }) {
		yield* crash(kind);

		expect(yield* defectReported()).toEqual([expected]);
	});

	redaction.it(`when a handler dies with ${kind}, the server span ends with it redacted`, [], function* ({ crash, defectInServerSpan }) {
		yield* crash(kind);

		expect(yield* defectInServerSpan()).toEqual([expected]);
	});

	redaction.it(`when a handler dies with ${kind}, the defect log carries it redacted`, [], function* ({ crash, defectLogged }) {
		yield* crash(kind);

		expect(yield* defectLogged()).toEqual([[expected]]);
	});

	redaction.it(`when a handler dies with ${kind}, no observer sees any of its secrets anywhere`, [], function* ({ crash, secretsSeen }) {
		yield* crash(kind);

		expect(yield* secretsSeen()).toEqual({ client: [], "error reporter": [], logs: [], "server span": [] });
	});
}

redaction.it("a session provider failure is logged with its message and a redacted cookie", [], function* ({ providerFailureLogged, providerFails }) {
	yield* providerFails();

	expect(yield* providerFailureLogged()).toEqual([{ cookie: "<redacted>", logged: "Authentication provider failed", message: "database closed" }]);
});

redaction.it("an external error marked as ignored stays unreported after redaction", [], function* ({ report }) {
	const ignored = new Error("password=ignored-secret");
	Object.defineProperty(ignored, ErrorReporter.ignore, { value: true });

	expect(yield* report(ignored)).toEqual([]);
});

redaction.it("the redacting error reporter hands on the severity and attributes with secrets redacted", [], function* ({ report }) {
	const defect = Object.assign(new Error("login failed for password=hunter2-plaintext"), {
		[ErrorReporter.severity]: "Error",
		[ErrorReporter.attributes]: { apiKey: "key-plaintext", userId: "u1" },
	});

	expect(yield* report(defect)).toEqual([
		{ attributes: { apiKey: "<redacted>", userId: "u1" }, message: "login failed for password=<redacted>", severity: "Error" },
	]);
});
