import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { textDiagnostics } from "#test/app-host/diagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const fields = ["attribute", "event", "event-attribute", "link-attribute", "span", "status"];
const masked = fields.map((field) => `${field} at https://example.test/${field}?code=<redacted>&state=<redacted>#<redacted>`);

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`a ${protocol} export masks the query and fragment of quoted, spaced URLs in every free-text span field`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), textDiagnostics],
		function* ({ close, exportMentions, request }) {
			yield* request("/diagnostics");

			yield* close();

			yield* outcomes({
				"leaked secrets": [exportMentions("hidden-"), []],
				"masked URLs": [exportMentions(...masked), masked],
			});
		},
	);
}
