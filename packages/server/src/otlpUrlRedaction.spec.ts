import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";
import { callbackDiagnostics, nestedUrlDiagnostics } from "#test/app-host/urlDiagnostics.ts";

const callbackForms = [
	"/api/auth/callback/github?code=<redacted>&state=<redacted>",
	"https://blob.example/x?sv=<redacted>&sig=<redacted>&se=<redacted>",
	"https://example.test/callback?code=<redacted>&state=<redacted>#<redacted>",
];
const nestedForms = [
	"https://<redacted>@example.test/path?unknown=<redacted>&unknown=<redacted>#<redacted>",
	"/path?arbitrary=<redacted>#<redacted>",
	"bare=<redacted>&empty=<redacted>&encoded%20name=<redacted>&next=<redacted>",
	"custom=<redacted>",
	"array=<redacted>",
	"nested=<redacted>",
];

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`a ${protocol} export masks query values in the server URL, the client URL and a quoted Referer header`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), callbackDiagnostics],
		function* ({ close, exportMentions, request }) {
			yield* request("/api/auth/callback/github?code=hidden-callback-code&state=hidden-callback-state", {
				headers: { referer: 'https://example.test/callback?code="hidden-referer-code"&state="hidden-referer-state"#"hidden-referer-fragment"' },
			});

			yield* close();

			yield* outcomes({
				"leaked secrets": [exportMentions("hidden-"), []],
				"masked URLs": [exportMentions(...callbackForms), callbackForms],
			});
		},
	);
	host.it(
		`a ${protocol} export masks URLs nested in arrays and objects on spans, events, links and resources`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), nestedUrlDiagnostics],
		function* ({ close, exportMentions, request }) {
			yield* request("/urls");

			yield* close();

			yield* outcomes({
				"leaked secrets": [exportMentions("hidden-"), []],
				"masked URLs": [exportMentions(...nestedForms), nestedForms],
			});
		},
	);
}
