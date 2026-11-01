import { expect } from "vitest";
import { environment, host, startupFails } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const invalid of ["not a URL", "", "http://", "http://localhost:invalid", "localhost:4318", "ftp://collector/v1/traces"]) {
	for (const base of [undefined, "http://127.0.0.1:4318"]) {
		host.it(
			`the malformed traces endpoint ${JSON.stringify(invalid)} fails startup with a typed config error ${base === undefined ? "without" : "despite"} a base endpoint`,
			[
				startupFails,
				environment({
					...(base === undefined ? {} : { "OTEL_EXPORTER_OTLP_ENDPOINT": base }),
					"OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": invalid,
				}),
			],
			function* ({ startup }) {
				expect(yield* startup()).toBe("failed with config error");
			},
		);
	}
}

host.it(
	"a malformed base endpoint fails startup with a typed config error when no traces endpoint is set",
	[startupFails, environment({ "OTEL_EXPORTER_OTLP_ENDPOINT": "not a URL" })],
	function* ({ startup }) {
		expect(yield* startup()).toBe("failed with config error");
	},
);

host.it(
	"a valid traces endpoint exports RPC spans even when the unused base endpoint is malformed",
	[collector({ endpoint: "traces" }), environment({ "OTEL_EXPORTER_OTLP_ENDPOINT": "not a URL" })],
	function* ({ close, exportedSpanNames, ping }) {
		yield* ping();

		yield* close();

		expect(yield* exportedSpanNames()).toContain("POST /rpc");
	},
);
