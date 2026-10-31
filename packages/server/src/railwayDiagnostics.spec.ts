import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reportedDiagnostics } from "#test/app-host/diagnostics.ts";
import { configuration, host, sessionPolicy } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`server logs and ErrorReporter failures reach OTLP ${protocol} with secrets redacted`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), reportedDiagnostics],
		function* ({ request, close, exportedSpanNames, exportedSpanStatus, exportMentions }) {
			yield* request("/reported");

			yield* close();

			yield* outcomes([
				["reported failure status", () => exportedSpanStatus("effect.error"), "error"],
				["diagnostic spans", () => exportedSpanNames(), expect.arrayContaining(["effect.log", "effect.error"])],
				[
					"diagnostics",
					() => exportMentions("server diagnostic", "server failure", "<redacted>"),
					["server diagnostic", "server failure", "<redacted>"],
				],
				["secrets", () => exportMentions("hidden-"), []],
			]);
		},
	);
	for (const kind of ["error", "unhandledrejection"]) {
		host.it(
			`a browser ${kind} reaches OTLP ${protocol} with its message, stack and URL redacted`,
			[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } })],
			function* ({ reportBrowserError, close, exportMentions, exportedSpanNames, exportedSpanStatus }) {
				const response = yield* reportBrowserError("browser failure token=hidden-message-token", {
					kind,
					stack: "Error: browser failure\n    at browserFrame (https://app.test/main.js?password=hidden-stack-password:1:2)",
				});

				yield* close();

				expect(response.status).toBe(HttpStatus.fromLiteral("Accepted"));
				yield* outcomes([
					["reported failure status", () => exportedSpanStatus("effect.error"), "error"],
					["error span", () => exportedSpanNames(), expect.arrayContaining(["effect.error"])],
					[
						"browser diagnostics",
						() => exportMentions("browser failure", "browserFrame", kind, "/notes?token=<redacted>"),
						["browser failure", "browserFrame", kind, "/notes?token=<redacted>"],
					],
					["secrets", () => exportMentions("hidden-"), []],
				]);
			},
		);
	}
}

host.it("the browser route refuses a client after twenty reports even when it spoofs forwarding headers", [], function* ({ reportBrowserError }) {
	for (let index = 0; index < 20; index += 1) {
		expect((yield* reportBrowserError("browser failure")).status).toBe(HttpStatus.fromLiteral("Accepted"));
	}

	const response = yield* reportBrowserError("browser failure", { headers: { "x-forwarded-for": "203.0.113.3", "x-real-ip": "203.0.113.2" } });

	expect(response.status).toBe(HttpStatus.fromLiteral("TooManyRequests"));
});

for (const [description, message, options, status] of [
	["a foreign origin", "failure", { headers: { origin: "https://elsewhere.test" } }, "Forbidden"],
	["an invalid report kind", "failure", { kind: "unknown" }, "BadRequest"],
	["an oversized report", "x".repeat(17_000), {}, "BadRequest"],
] as const) {
	host.it(`the browser route refuses ${description}`, [], function* ({ reportBrowserError }) {
		expect((yield* reportBrowserError(message, options)).status).toBe(HttpStatus.fromLiteral(status));
	});
}

host.it("without an exporter the host serves HTTP and accepts browser reports", [], function* ({ ping, reportBrowserError }) {
	const reply = yield* ping();
	const response = yield* reportBrowserError("local browser failure");

	yield* outcomes([
		["RPC answer", () => Effect.succeed(reply), "pong"],
		["browser report status", () => Effect.succeed(response.status), HttpStatus.fromLiteral("Accepted")],
	]);
});

host.it(
	"a second client behind a trusted proxy keeps its own browser reporting budget",
	[sessionPolicy, configuration({ trustedProxy: "127.0.0.1" })],
	function* ({ reportBrowserError }) {
		for (let index = 0; index < 20; index += 1) {
			yield* reportBrowserError("first client", { headers: { "x-real-ip": "203.0.113.1" } });
		}
		expect((yield* reportBrowserError("first client", { headers: { "x-real-ip": "203.0.113.1" } })).status).toBe(
			HttpStatus.fromLiteral("TooManyRequests"),
		);

		const response = yield* reportBrowserError("second client", { headers: { "x-real-ip": "203.0.113.2" } });

		expect(response.status).toBe(HttpStatus.fromLiteral("Accepted"));
	},
);

host.it(
	"host startup logs outside request spans reach OTLP",
	[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } })],
	function* ({ close, exportMentions }) {
		yield* close();

		expect(yield* exportMentions("Listening on", "effect.log")).toEqual(["Listening on", "effect.log"]);
	},
);
