import { Effect } from "effect";
import { expect } from "vitest";
import { defectiveRpc, tracingDeclaration } from "#test/app-host/requestTracing.ts";
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
	expect(defects).toHaveLength(1);
	expect(defects[0]).toMatchObject({
		annotations: {
			requestId: expect.stringMatching(/^[a-f0-9]{32}$/u),
			"rpc.defect": [expect.objectContaining({ message: "password=<redacted>" })],
			"rpc.method": "ping",
		},
		level: "Error",
		message: ["RPC defect"],
	});
	expect(JSON.stringify({ defects, result })).not.toContain("hidden-defect-password");
	expect(yield* directPing()).toBe("pong");
});
