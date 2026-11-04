import { Config, ConfigProvider, Effect } from "effect";

export function vitePort(name: string, fallback: number): number {
	return Effect.runSync(Config.Int(name).pipe(Config.withDefault(fallback)).parse(ConfigProvider.fromEnv()));
}
