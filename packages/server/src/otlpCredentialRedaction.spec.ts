import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { credentialDiagnostics } from "#test/app-host/credentialDiagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const masked = [
	"host/path sig=<redacted>",
	"error: request failed sig=<redacted>&x=1",
	"error: sig=<redacted>&x=1",
	"host/path?sig=<redacted>&x=<redacted>",
	"before <redacted> after",
];

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`a ${protocol} export masks bare signatures and whole PEM private keys`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), credentialDiagnostics],
		function* ({ close, exportMentions, request }) {
			yield* request("/credentials");

			yield* close();

			yield* outcomes({
				"leaked secrets": [exportMentions("hidden-", "second-line", "PRIVATE KEY"), []],
				"masked text": [exportMentions(...masked), masked],
			});
		},
	);
}
