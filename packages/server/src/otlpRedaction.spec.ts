import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { sensitiveDiagnostics } from "#test/app-host/diagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`redacts sensitive diagnostics before ${protocol} export`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), sensitiveDiagnostics],
		function* ({ request, close, exports, exportedSpans }) {
			expect(
				(yield* request("/failed", { headers: { authorization: "Bearer hidden-header-token", cookie: "session=hidden-header-cookie" } })).status,
			).toBe(HttpStatus.fromLiteral("InternalServerError"));
			yield* close();
			expect(exports()).toMatchObject([{ path: "/v1/traces" }]);
			const body = exports()[0]?.body;
			expect(body).toContain("resource-name");
			expect(exports()[0]?.contentType).toBe(protocol === "http/protobuf" ? "application/x-protobuf" : "application/json");
			if (protocol === "http/protobuf") {
				expect(exportedSpans().map(({ name }) => name)).toContain("GET /failed");
				expect(() => JSON.parse(body ?? "")).toThrow();
			} else {
				expect(JSON.parse(body ?? "")).toHaveProperty("resourceSpans");
			}
			expect(body).toContain("<redacted>");
			expect(body).not.toContain("hidden-");
		},
	);
}
