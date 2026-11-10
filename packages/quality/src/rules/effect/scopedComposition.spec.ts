import { expect } from "@effect/vitest";
import { contextCapture } from "#rules/effect/contextCapture.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { ruleCases } from "#test/ruleCases.ts";

const repository = ruleCases.repository(effectResolves());

for (const acquisition of [
	"Context.merge(inherited, yield* Layer.build(live))",
	"yield* Scope.provide(restart)(Layer.build(live))",
	"yield* Layer.build(live).pipe(Scope.provide(restart))",
	"(yield* Layer.build(live)).pipe(Context.merge(inherited))",
]) {
	ruleCases.it(
		`context capture accepts application kit composition through ${acquisition} beside an ambient capture`,
		[
			repository.has({
				content: `import { Context, Effect, Layer, Scope } from "effect";
class Store extends Context.Service<Store, { readonly read: Effect.Effect<string> }>()("app/Store") {}
const live = Layer.succeed(Store)({ read: Effect.succeed("ready") });
export const kit = Effect.gen(function* () {
 const inherited = yield* Effect.context<Store>();
 const restart = yield* Scope.make();
 const environment = ${acquisition};
 return Effect.runPromiseWith(environment);
});
export const ambient = Effect.gen(function* () {
 const environment = yield* Effect.context<Store>();
 return Effect.runPromiseWith(environment);
});`,
				path: "src/application-story.ts",
			}),
		],
		function* ({ check }) {
			expect(yield* check(contextCapture)).toEqual([expect.objectContaining({ file: "src/application-story.ts", line: 12 })]);
		},
	);
}
