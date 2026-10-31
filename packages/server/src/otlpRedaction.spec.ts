import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sensitiveDiagnostics } from "#test/app-host/diagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`a ${protocol} export masks sensitive headers, attributes, events, links, resources and errors but keeps the service name`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), sensitiveDiagnostics],
		function* ({ close, exportMentions, request }) {
			yield* request("/failed", { headers: { authorization: "Bearer hidden-header-token", cookie: "session=hidden-header-cookie" } });

			yield* close();

			yield* outcomes({
				"kept text": [exportMentions("resource-name", "<redacted>"), ["resource-name", "<redacted>"]],
				"leaked secrets": [exportMentions("hidden-"), []],
			});
		},
	);
}
