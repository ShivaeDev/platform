import { Effect } from "effect";
import { expect } from "vitest";
import { defectiveRpc, traceEcho, tracingDeclaration } from "#test/app-host/requestTracing.ts";
import { host } from "#test/app-host/story.ts";

for (const position of ["omitted", "first", "last"] as const) {
	host.it(
		`traces authentication once when the shared tracing declaration is ${position}`,
		[tracingDeclaration(position)],
		function* ({ ping, logs }) {
			expect(yield* ping({ authenticated: true }).pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
			const failures = logs().filter((entry) => entry.annotations["rpc.method"] === "ping");
			expect(failures).toEqual([
				{
					annotations: {
						requestId: expect.stringMatching(/^[a-f0-9]{32}$/u),
						"rpc.failure": "Unauthorized",
						"rpc.method": "ping",
						"rpc.payload": undefined,
					},
					attempt: 0,
					level: "Info",
					message: ["RPC failure"],
				},
			]);
		},
	);
}

host.it("traces and redacts a loopback RPC defect without changing the shared group", [defectiveRpc], function* ({ ping, directPing, logs }) {
	const result = yield* ping().pipe(Effect.result);
	expect(result).toMatchObject({ _tag: "Failure", failure: expect.objectContaining({ message: "password=<redacted>", name: "Error" }) });
	const defects = logs().filter((entry) => entry.annotations["rpc.method"] === "ping");
	expect(defects).toMatchObject([
		{
			annotations: {
				requestId: expect.stringMatching(/^[a-f0-9]{32}$/u),
				"rpc.defect": [expect.objectContaining({ message: "password=<redacted>" })],
				"rpc.method": "ping",
			},
			level: "Error",
			message: ["RPC defect"],
		},
	]);
	expect(JSON.stringify({ defects, result })).not.toContain("hidden-defect-password");
	expect(yield* directPing()).toBe("pong");
});

host.it("continues an incoming W3C trace in RPC handling without an installed exporter", [traceEcho], function* ({ request }) {
	const traceId = "0123456789abcdef0123456789abcdef";
	const response = yield* request("/rpc", {
		body: `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "ping" })}\n`,
		headers: { "content-type": "application/ndjson", traceparent: `00-${traceId}-0123456789abcdef-01` },
		method: "POST",
	});
	expect(response.body).toContain(traceId);
});
