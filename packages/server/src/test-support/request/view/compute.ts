import { Effect, Ref } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { Shared } from "#test/request/Shared.ts";

export const compute = Effect.fn("RequestViewService.compute")(function* () {
	const user = yield* SessionUser;
	const shared = yield* Shared;
	const computation = yield* Ref.updateAndGet(shared.computations, (value) => value + 1);
	return { build: shared.build, caller: user.id, computation };
});
