import { expect } from "vitest";
import { textDiagnostics } from "#test/app-host/diagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`redacts quoted and spaced URLs in free-text trace fields before ${protocol} export`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), textDiagnostics],
		function* ({ request, close, exports }) {
			expect(
				(yield* request("/diagnostics", { headers: { authorization: "Bearer hidden-header-token", cookie: "session=hidden-header-cookie" } })).status,
			).toBe(500);
			yield* close();
			expect(exports()).toHaveLength(1);
			expect(exports()[0]?.contentType).toBe(protocol === "http/json" ? "application/json" : "application/x-protobuf");
			const body = exports()[0]?.body;
			expect(body).not.toContain("hidden-");
			for (const field of ["attribute", "event", "event-attribute", "link-attribute", "span", "status"]) {
				expect(body).toContain(`${field} at https://example.test/${field}?code=<redacted>&state=<redacted>#<redacted>`);
			}
		},
	);
}
