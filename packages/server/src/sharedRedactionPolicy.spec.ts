import { expect } from "vitest";
import { sharedDiagnostics } from "#test/app-host/sharedDiagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`masks connection strings, database users and URL values alike in logs, error reports and ${protocol} spans`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), sharedDiagnostics],
		function* ({ request, close, diagnosticSinks }) {
			yield* request("/shared-diagnostics");
			yield* close();

			const masked = {
				"db.connection_string": "<redacted>",
				"db.user": "<redacted>",
				"db.user.name": "<redacted>",
				detail: "connect postgres://<redacted>@localhost/app?custom=<redacted>#<redacted>",
				"url.query": ["code=<redacted>", "state=<redacted>"],
				visible: "public diagnostic",
			};
			expect(yield* diagnosticSinks("database diagnostics")).toEqual({ log: masked, report: masked, span: masked });
		},
	);
}
