import { Effect } from "effect";
import { planning } from "./planning.ts";
import { vitestFixture } from "./vitestFixture.ts";

export const vitestWorkspace = planning.trait("workspace", "Vitest discovers shared, measured and new files", function* (engine) {
	engine.vitest = yield* Effect.acquireRelease(Effect.promise(vitestFixture), (fixture) => Effect.promise(() => fixture.close()));
});
