import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { browserErrors } from "#test/app-host/diagnostics.ts";
import { host, sessionPolicy } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const examples = [
	["contraction before a literal", "Can't parse 'yes, maybe later'", "Can't parse '<redacted>'", ["yes, maybe later"]],
	[
		"JSON parse",
		`Unexpected token 'y', "yes, maybe later" is not valid JSON`,
		`Unexpected token '<redacted>', "<redacted>" is not valid JSON`,
		["yes, maybe later", "'y'"],
	],
	[
		"function call",
		`TypeError: "we fought about the ending" is not a function`,
		`TypeError: "<redacted>" is not a function`,
		["we fought about the ending"],
	],
	[
		"escaped quotes",
		String.raw`TypeError: "she said \"stay\" yesterday" is not a function`,
		`TypeError: "<redacted>" is not a function`,
		["she said", "stay", "yesterday"],
	],
	["multiline literal", "Invalid value `first line\nsecond line`", "Invalid value `<redacted>`", ["first line", "second line"]],
] as const;

for (const protocol of ["http/json", "http/protobuf"]) {
	for (const [description, message, masked, secrets] of examples) {
		host.it(
			`a browser ${description} error keeps its shape and stack frames in Error reports and logs over ${protocol} without quoted text`,
			[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), browserErrors({ log: true })],
			function* ({ reportBrowserError, close, browserReportLogs, browserReportSpans, exportMentions, logMentions }) {
				const response = yield* reportBrowserError(message, { stack: `${message}\n    at browserFrame (https://app.test/main.js:1:2)` });

				yield* close();

				expect(response.status).toBe(HttpStatus.fromLiteral("Accepted"));
				const expectedSpan = {
					attributes: { "error.severity": "Error" },
					exceptions: [{ "exception.message": masked, "exception.stacktrace": expect.stringContaining("browserFrame") }],
				};
				yield* outcomes([
					["error report", () => browserReportSpans(), [expectedSpan]],
					["error log", () => browserReportLogs(), [{ level: "Error", text: expect.stringContaining(masked) }]],
					["log stack", () => logMentions("browserFrame"), ["browserFrame"]],
					["quoted text in exports", () => exportMentions(...secrets), []],
					["quoted text in logs", () => logMentions(...secrets), []],
				]);
			},
		);
	}
}

host.it(
	"browser reporting defaults accept signed-out reports without logging or looking up a session",
	[sessionPolicy],
	function* ({ reportBrowserError, browserReportLogs, sessionLookups }) {
		const response = yield* reportBrowserError("before sign-in");

		expect(response.status).toBe(HttpStatus.fromLiteral("Accepted"));
		yield* outcomes([
			["browser logs", () => browserReportLogs(), []],
			["session lookups", () => sessionLookups(), []],
		]);
	},
);

host.it(
	"user attribution adds the signed-in user's id to the HTTP and error spans without requiring a session",
	[sessionPolicy, collector(), browserErrors({ includeUserId: true })],
	function* ({ reportBrowserError, close, browserReportSpans, serverSpan }) {
		yield* reportBrowserError("alice's browser failure", { headers: { authorization: "alice" } });

		yield* close();

		yield* outcomes([
			["error span", () => browserReportSpans(), [{ attributes: { "user.id": "alice" } }]],
			["HTTP span", () => serverSpan("POST /_platform/errors"), { attributes: { "user.id": "alice" } }],
		]);
	},
);

host.it(
	"optional user attribution accepts a signed-out report without a user id",
	[sessionPolicy, collector(), browserErrors({ includeUserId: true })],
	function* ({ reportBrowserError, close, browserReportSpans }) {
		const response = yield* reportBrowserError("signed-out failure");

		yield* close();

		expect(response.status).toBe(HttpStatus.fromLiteral("Accepted"));
		expect(yield* browserReportSpans()).toEqual([
			expect.objectContaining({ attributes: expect.not.objectContaining({ "user.id": expect.anything() }) }),
		]);
	},
);

for (const [description, headers, status] of [
	["a signed-out report", {}, "Unauthorized"],
	["a session-store outage", { authorization: "outage" }, "ServiceUnavailable"],
] as const) {
	host.it(
		`requiring a browser session refuses ${description} without recording the report`,
		[sessionPolicy, collector(), browserErrors({ log: true, requireSession: true })],
		function* ({ reportBrowserError, close, browserReportSpans, browserReportLogs }) {
			const response = yield* reportBrowserError("private failure", { headers });

			yield* close();

			expect(response.status).toBe(HttpStatus.fromLiteral(status));
			yield* outcomes([
				["error reports", () => browserReportSpans(), []],
				["browser logs", () => browserReportLogs(), []],
			]);
		},
	);
}

host.it(
	"requiring a browser session accepts a signed-in report without enabling user attribution",
	[sessionPolicy, collector(), browserErrors({ requireSession: true })],
	function* ({ reportBrowserError, close, browserReportSpans }) {
		const response = yield* reportBrowserError("signed-in failure", { headers: { authorization: "alice" } });

		yield* close();

		expect(response.status).toBe(HttpStatus.fromLiteral("Accepted"));
		expect(yield* browserReportSpans()).toEqual([
			expect.objectContaining({ attributes: expect.not.objectContaining({ "user.id": expect.anything() }) }),
		]);
	},
);
