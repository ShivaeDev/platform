import { Effect } from "effect";
import { counter, incremented } from "./counter.ts";
import { lifetime, resource } from "./lifetime.ts";
import { noteLifetime } from "./lifetimeLog.ts";

lifetime.it("passes with a scoped resource", [resource], function* ({ recordsBody }) {
	yield* recordsBody();
});

lifetime.it("fails with a scoped resource", [resource], function* ({ recordsBody }) {
	yield* recordsBody();
	yield* Effect.fail("the story fails on purpose");
});

counter.it("counts with Effect-returning hooks", [incremented], function* () {
	yield* noteLifetime("body");
});
