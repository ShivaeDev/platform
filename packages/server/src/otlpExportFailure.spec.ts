import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { host } from "#test/app-host/story.ts";
import { collector, flushable } from "#test/app-host/telemetry.ts";

const leakyCollector = {
	answer: "Unsupported content type; token=hidden-collector-token",
	env: { "OTEL_EXPORTER_OTLP_HEADERS": "authorization=hidden-exporter-secret" },
};

for (const [failure, options] of [
	[`a ${HttpStatus.fromLiteral("BadRequest")} answer`, { status: HttpStatus.fromLiteral("BadRequest") }],
	[`a ${HttpStatus.fromLiteral("ServiceUnavailable")} answer`, { status: HttpStatus.fromLiteral("ServiceUnavailable") }],
	["an offline collector", { offline: true }],
] as const) {
	host.it(
		`two exports failing with ${failure} warn once`,
		[collector({ ...leakyCollector, ...options }), flushable()],
		function* ({ exportWarnings, flushedRequest }) {
			yield* flushedRequest();
			yield* flushedRequest();

			expect(yield* exportWarnings()).toMatchObject([{ message: "OTLP trace export failed" }]);
		},
	);

	host.it(
		`the warning for ${failure} carries neither the exporter's header nor the collector's token`,
		[collector({ ...leakyCollector, ...options }), flushable()],
		function* ({ exportWarnings, flushedRequest, logMentions }) {
			yield* flushedRequest();

			yield* outcomes({
				"leaked secrets": [logMentions("hidden-exporter-secret", "hidden-collector-token"), []],
				"warnings": [exportWarnings(), [expect.objectContaining({ message: "OTLP trace export failed" })]],
			});
		},
	);
}

for (const status of [HttpStatus.fromLiteral("BadRequest"), HttpStatus.fromLiteral("ServiceUnavailable")]) {
	host.it(
		`the warning for a ${status} answer names the status and the collector's redacted answer`,
		[collector({ ...leakyCollector, status }), flushable()],
		function* ({ exportWarnings, flushedRequest }) {
			yield* flushedRequest();

			expect(yield* exportWarnings()).toMatchObject([
				{ annotations: { "otlp.response": "Unsupported content type; token=<redacted>", "otlp.status": status } },
			]);
		},
	);
}

host.it(
	"the warning for an offline collector names a transport failure",
	[collector({ offline: true }), flushable()],
	function* ({ exportWarnings, flushedRequest }) {
		yield* flushedRequest();

		expect(yield* exportWarnings()).toMatchObject([{ annotations: { "otlp.failure": "TransportError" } }]);
	},
);

host.it(
	"export warnings return after the collector recovers",
	[
		collector({
			status: (attempt) =>
				[
					HttpStatus.fromLiteral("BadRequest"),
					HttpStatus.fromLiteral("BadRequest"),
					HttpStatus.fromLiteral("OK"),
					HttpStatus.fromLiteral("BadRequest"),
				][attempt - 1] ?? HttpStatus.fromLiteral("OK"),
		}),
	],
	function* ({ collectorAnswers }) {
		expect(yield* collectorAnswers(4)).toEqual([
			`${HttpStatus.fromLiteral("BadRequest")} warned`,
			`${HttpStatus.fromLiteral("BadRequest")} quiet`,
			`${HttpStatus.fromLiteral("OK")} quiet`,
			`${HttpStatus.fromLiteral("BadRequest")} warned`,
		]);
	},
);
