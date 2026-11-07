import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { compute } from "#test/request/view/compute.ts";

export const initialize = Effect.gen(function* () {
	const { id } = yield* SessionUser;
	return { cached: yield* Effect.cached(compute()), caller: id };
});
