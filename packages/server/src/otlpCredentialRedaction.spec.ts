import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { credentialDiagnostics } from "#test/app-host/credentialDiagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`redacts bare signatures and PEM private keys before ${protocol} export`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), credentialDiagnostics],
		function* ({ request, close, exports }) {
			expect((yield* request("/credentials")).status).toBe(HttpStatus.fromLiteral("OK"));
			yield* close();
			expect(exports()).toMatchObject([{ path: "/v1/traces" }]);
			const body = exports()[0]?.body;
			expect(body).not.toContain("hidden-");
			expect(body).not.toContain("second-line");
			expect(body).not.toContain("PRIVATE KEY");
			expect(body).toContain("host/path sig=<redacted>");
			expect(body).toContain("error: request failed sig=<redacted>&x=1");
			expect(body).toContain("error: sig=<redacted>&x=1");
			expect(body).toContain("host/path?sig=<redacted>&x=<redacted>");
			expect(body).toContain("before <redacted> after");
		},
	);
}
