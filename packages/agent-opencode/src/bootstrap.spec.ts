import { expect } from "@effect/vitest";
import { bootstrap } from "#test/bootstrap.ts";

bootstrap.it("a missing executable reports backend unavailability", [], function* ({ startWithoutExecutable }) {
	const outcome = yield* startWithoutExecutable();

	expect(outcome).toEqual({ backend: "opencode", outcome: "backend unavailable" });
});
