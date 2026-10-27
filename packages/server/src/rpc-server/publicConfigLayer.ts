import { Config, type ConfigProvider, Effect } from "effect";
import type { publicConfig } from "@shivaedev/contract/publicConfig.ts";

export function publicConfigLayer<T, E>(declaration: ReturnType<typeof publicConfig<T, E>>, path?: string | ConfigProvider.Path) {
	const application = declaration.application;
	return application.toLayer(
		Effect.gen(function* () {
			const value = yield* Config.schema(declaration.declaration.queries[0].success, path);
			return application.of({ "platform.publicConfig.get": () => Effect.succeed(value) });
		}),
	);
}
