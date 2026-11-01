import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { rejections as rejectionStories } from "#test/http-client/rejections.ts";

for (const transport of ["fetch", "node"] as const) {
	const rejections = rejectionStories(transport);
	for (const [reply, failure] of [
		["status", "RemoteNotFound"],
		["length", "ResponseBodyTooLarge"],
		["chunked", "ResponseBodyTooLarge"],
		["invalid", "InvalidBodyLimit"],
	] as const) {
		rejections.it(`a ${reply} rejection closes the connection while the server withholds the body`, [], function* ({ connectionClosed, read }) {
			const result = yield* read(reply);
			yield* outcomes([
				["failure", () => Effect.succeed(result), failure],
				["connection", connectionClosed, "closed"],
			]);
		});
		rejections.it(`repeated ${reply} rejections leave capacity for the next request`, [], function* ({ read }) {
			for (let index = 0; index < 5; index += 1) {
				expect(yield* read(reply)).toBe(failure);
			}
			expect(yield* read("ok")).toEqual({ name: "paper" });
		});
	}
	if (transport !== "fetch") {
		rejections.it("a schema rejection returns the connection to the one-connection pool", [], function* ({ connectionsSeen, read }) {
			const refusals = 5;
			for (let index = 0; index < refusals; index += 1) {
				expect(yield* read("schema")).toBe("SchemaError");
			}
			expect(yield* read("ok")).toEqual({ name: "paper" });
			const ports = yield* connectionsSeen();
			expect(ports).toHaveLength(refusals + 1);
			expect([...new Set(ports)]).toEqual([ports[0]]);
		});
	}
}
