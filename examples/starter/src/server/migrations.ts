import { Effect, Layer } from "effect";
import { serverModules } from "#server/modules.ts";

export function migrations() {
	return Effect.map(serverModules(Layer.empty), (modules) => ({ ...modules.migrations, table: "app_migrations" }));
}
