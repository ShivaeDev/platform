import { expect } from "@effect/vitest";
import { localProcess } from "#test/localProcess.ts";

localProcess.it("the local app-server process handles framed Unicode replies", [], function* ({ start, transcript }) {
	yield* start();

	const result = yield* transcript();

	expect(result).toMatchObject({
		completeness: "complete",
		events: [{ parts: [{ text: "ready ✓", type: "text" }], role: "agent", type: "message" }],
	});
});
localProcess.it("CLI version drift is diagnosed during the public Layer's handshake", [], function* ({ logs }) {
	expect(JSON.stringify(yield* logs())).toContain("codex app-server version differs from the pin");
});
