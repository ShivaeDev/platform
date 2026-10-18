import { expect } from "vitest";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";
import { callbackDiagnostics, nestedUrlDiagnostics } from "#test/app-host/urlDiagnostics.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`redacts query values in server URLs, client URLs and quoted Referer headers before ${protocol} export`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), callbackDiagnostics],
		function* ({ request, close, exports }) {
			expect(
				(yield* request("/api/auth/callback/github?code=c1&state=s1", {
					headers: { referer: 'https://example.test/callback?code="c1"&state="s1"#"hidden-referer-fragment"' },
				})).status,
			).toBe(200);
			yield* close();
			const body = exports()
				.map((exported) => exported.body)
				.join("\n");
			for (const secret of ["c1", "s1", "s2"]) {
				expect(body).not.toContain(secret);
			}
			expect(body).toContain("/api/auth/callback/github?code=<redacted>&state=<redacted>");
			expect(body).toContain("https://blob.example/x?sv=<redacted>&sig=<redacted>&se=<redacted>");
			expect(exports()).toHaveLength(1);
			expect(exports()[0]?.contentType).toBe(protocol === "http/json" ? "application/json" : "application/x-protobuf");
			expect(body).not.toContain("hidden-referer-fragment");
			expect(body).toContain("http.request.header.referer");
			expect(body).toContain("https://example.test/callback?code=<redacted>&state=<redacted>#<redacted>");
			expect(body).toContain("url.query");
			expect(body).toContain("code=<redacted>&state=<redacted>");
			expect(body).toContain("sv=<redacted>&sig=<redacted>&se=<redacted>");
			if (protocol === "http/json") {
				expect(body).toContain('"kind":2');
				expect(body).toContain('"kind":3');
			}
		},
	);
	host.it(
		`redacts URL attributes recursively on spans, events, links and resources under ${protocol}, including free text`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), nestedUrlDiagnostics],
		function* ({ request, close, exports }) {
			expect((yield* request("/urls")).status).toBe(500);
			yield* close();
			const body = exports()
				.map((exported) => exported.body)
				.join("\n");
			expect(exports()).toHaveLength(1);
			expect(body).not.toContain("hidden-");
			expect(body).toContain("https://<redacted>@example.test/path?unknown=<redacted>&unknown=<redacted>#<redacted>");
			expect(body).toContain("/path?arbitrary=<redacted>#<redacted>");
			expect(body).toContain("bare=<redacted>&empty=<redacted>&encoded%20name=<redacted>&next=<redacted>");
			expect(body).toContain("url.fragment");
			expect(body).toContain("custom=<redacted>");
			expect(body).toContain("array=<redacted>");
			expect(body).toContain("nested=<redacted>");
		},
	);
}
