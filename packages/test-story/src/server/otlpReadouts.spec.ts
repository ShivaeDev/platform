import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { otlpReadoutApp } from "#test/otlpReadoutApp.ts";

const buffered = otlpReadoutApp(false);
const protobuf = otlpReadoutApp(true);
const inFlight = otlpReadoutApp(false, true);
const postgresJson = otlpReadoutApp(false, false, true);
const postgresProtobuf = otlpReadoutApp(true, false, true);

for (const app of [buffered, protobuf]) {
	app.it("distinguishes a redacted secret from a leaked secret in exports", [], function* ({ tracesSecret, flush, exportsSecret }) {
		yield* tracesSecret("redacted credential", true);
		yield* tracesSecret('leaked "credential"\n雪', false);
		yield* flush();

		yield* outcomes([
			["redacted credential exported", () => exportsSecret("redacted credential"), false],
			["leaked credential exported", () => exportsSecret('leaked "credential"\n雪'), true],
		]);
	});

	app.it("reads the operation, message and type of a reported failure once", [], function* ({ reports, flush, errors }) {
		yield* reports("Document storage is unavailable");
		yield* flush();

		expect(yield* errors()).toEqual([{ message: "Document storage is unavailable", operation: "save document", type: "Error" }]);
	});

	app.it("finds a secret outside span attributes", [], function* ({ tracesSecretEvent, flush, exportsSecret }) {
		yield* tracesSecretEvent('event "secret"\n雪');
		yield* flush();

		expect(yield* exportsSecret('event "secret"\n雪')).toBe(true);
	});
}

buffered.it("keeps repeated queries from older exporters in received order", [], function* ({ tracesLegacyQuery, flush, queries }) {
	yield* tracesLegacyQuery("SELECT title FROM documents");
	yield* tracesLegacyQuery("SELECT title FROM documents");
	yield* flush();

	expect(yield* queries()).toEqual(["SELECT title FROM documents", "SELECT title FROM documents"]);
});

buffered.it("reads status-only failures and uses the operation when no message is supplied", [], function* ({ reportsStatus, errors }) {
	yield* reportsStatus("send email", "Mailbox is unavailable");
	yield* reportsStatus("sync documents");

	expect(yield* errors()).toEqual([
		{ message: "Mailbox is unavailable", operation: "send email", type: undefined },
		{ message: "sync documents", operation: "sync documents", type: undefined },
	]);
});

buffered.it("finds escaped keys and values outside the decoded spans", [], function* ({ exportsMetadata, exportsSecret }) {
	yield* exportsMetadata({ 'provider "key"': 'metadata "secret"\n雪' });

	yield* outcomes([
		["escaped key exported", () => exportsSecret('provider "key"'), true],
		["escaped value exported", () => exportsSecret('metadata "secret"\n雪'), true],
	]);
});

for (const app of [postgresJson, postgresProtobuf]) {
	app.it("reads the queries traced by a real PostgreSQL client", [], function* ({ runQuery, flush, queries }) {
		yield* runQuery();
		yield* flush();

		expect(yield* queries()).toEqual(["SELECT 'story query' AS title"]);
	});
}

for (const [app, delivery] of [
	[buffered, "buffered"],
	[inFlight, "already exporting"],
] as const) {
	app.it(`flush waits for ${delivery} telemetry and supports later work`, [], function* ({ reports, flush, errors }) {
		yield* reports("first failure");
		yield* flush();

		expect(yield* errors()).toEqual([{ message: "first failure", operation: "save document", type: "Error" }]);

		yield* reports("second failure");
		yield* flush();

		expect(yield* errors()).toEqual([
			{ message: "first failure", operation: "save document", type: "Error" },
			{ message: "second failure", operation: "save document", type: "Error" },
		]);
	});
}

buffered.it(
	"records logs as span events without changing logging outside the tracing scope",
	[],
	function* ({ logs, flush, tracedLogs, closesTracing, untracedLogEvents }) {
		expect(yield* untracedLogEvents()).toEqual([]);

		yield* logs("document saved");
		yield* flush();

		expect(yield* tracedLogs()).toEqual(["document saved"]);

		yield* closesTracing();

		expect(yield* untracedLogEvents()).toEqual([]);
	},
);
