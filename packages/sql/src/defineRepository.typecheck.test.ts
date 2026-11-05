import { Context, Effect, type Layer, type Scope } from "effect";
import type { SqlClient } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import { defineRepository } from "#defineRepository.ts";
import type { PotStorage } from "#test/diary/PotStorage.ts";
import type { Pots } from "#test/diary/Pots.ts";

class Codec extends Context.Service<Codec, string>()("@shivaedev/sql/shared-pots/Codec") {}
class InitializationFailure extends Error {}

const Repository = defineRepository({
	id: "@shivaedev/sql/TypedRepository",
	initialize: Effect.gen(function* () {
		const codec = yield* Codec;
		yield* Effect.addFinalizer(() => Effect.void);
		if (codec === "invalid") {
			return yield* Effect.fail(new InitializationFailure());
		}
		return {
			codec,
			open: () => Effect.acquireRelease(Effect.service(Codec), () => Effect.void),
		};
	}),
});

it("repository definitions retain values, operation requirements and typed initialization errors in their native Layer", () => {
	expectTypeOf<Layer.Services<typeof Repository.layer>>().toEqualTypeOf<Codec>();
	expectTypeOf<Layer.Error<typeof Repository.layer>>().toEqualTypeOf<InitializationFailure>();
	expectTypeOf<Layer.Success<typeof Repository.layer>>().toEqualTypeOf<"@shivaedev/sql/TypedRepository">();
	expectTypeOf<Context.Service.Shape<typeof Repository>["codec"]>().toEqualTypeOf<string>();
	expectTypeOf<Effect.Services<ReturnType<Context.Service.Shape<typeof Repository>["open"]>>>().toEqualTypeOf<Codec | Scope.Scope>();
	expectTypeOf<Layer.Services<typeof Pots.layer>>().toEqualTypeOf<SqlClient.SqlClient | PotStorage>();
});
