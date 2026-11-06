export function compositionFiles(path: string, assembled = true, provision = "Effect.scoped") {
	return {
		content: `import { Context, Effect, Layer } from "effect";
class Store extends Context.Service<Store, { readonly read: Effect.Effect<string> }>()("app/Store") {}
const live = Layer.succeed(Store)({ read: Effect.succeed("ready") });
export const application = Effect.gen(function* () {
 const environment = yield* ${assembled ? "Layer.build(live)" : "Effect.context<Store>()"};
 const run = Effect.runPromiseWith(environment);
 const harness = { run: () => run(Effect.flatMap(Store, (store) => store.read)) };
 return yield* Effect.promise(() => harness.run());
}).pipe(${provision});`,
		path,
	};
}
