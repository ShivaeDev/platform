import { Config, type ConfigProvider, Effect } from "effect";
import type { publicConfig } from "#rpc/publicConfig.ts";

export function publicConfigLayer<T, E>(declaration: ReturnType<typeof publicConfig<T, E>>, path?: string | ConfigProvider.Path) {
	return declaration.toLayer(
		Effect.gen(function* () {
			const value = yield* Config.schema(declaration.declaration.queries[0].success, path);
			return declaration.of({ "platform.publicConfig.get": () => Effect.succeed(value) });
		}),
	);
}
