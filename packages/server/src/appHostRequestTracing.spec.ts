import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defectiveRpc, traceEcho, tracingDeclaration } from "#test/app-host/requestTracing.ts";
import { host } from "#test/app-host/story.ts";

const requestId = expect.stringMatching(/^[a-f0-9]{32}$/u);

for (const position of ["omitted", "first", "last"] as const) {
	host.it(
		`with the shared tracing declaration ${position}, an unauthenticated ping logs exactly one unauthorized RPC failure`,
		[tracingDeclaration(position)],
		function* ({ pingOutcome, rpcLogs }) {
			yield* pingOutcome({ authenticated: true });

			expect(yield* rpcLogs("ping")).toEqual([
				{
					annotations: { requestId, "rpc.failure": "Unauthorized", "rpc.method": "ping", "rpc.payload": undefined },
					level: "Info",
					message: "RPC failure",
				},
			]);
		},
	);
}

host.it("a loopback RPC defect reaches the native client with its password redacted", [defectiveRpc], function* ({ pingOutcome }) {
	expect(yield* pingOutcome()).toBe("failed with password=<redacted>");
});

host.it(
	"a loopback RPC defect is logged once at Error with its password redacted",
	[defectiveRpc],
	function* ({ logMentions, pingOutcome, rpcLogs }) {
		yield* pingOutcome();

		yield* outcomes({
			"leaked secrets": [logMentions("hidden-defect-password"), []],
			"ping logs": [
				rpcLogs("ping"),
				[
					expect.objectContaining({
						annotations: expect.objectContaining({ requestId, "rpc.defect": [expect.objectContaining({ message: "password=<redacted>" })] }),
						level: "Error",
						message: "RPC defect",
					}),
				],
			],
		});
	},
);

host.it("hosting a group with tracing leaves the shared group serving an independent server untraced", [defectiveRpc], function* ({ directPing }) {
	expect(yield* directPing()).toBe("pong");
});

host.it("an RPC handler continues the incoming W3C trace without an installed exporter", [traceEcho], function* ({ request }) {
	const traceId = "0123456789abcdef0123456789abcdef";

	const response = yield* request("/rpc", {
		body: `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "ping" })}\n`,
		headers: { "content-type": "application/ndjson", traceparent: `00-${traceId}-0123456789abcdef-01` },
		method: "POST",
	});

	expect(response.body).toContain(traceId);
});
