import { Config, Effect, Layer, Option } from "effect";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type ServerOptions, startServer } from "./server.ts";
import { mountView } from "./view.tsx";

const databaseUrl = Option.getOrUndefined(Effect.runSync(Config.option(Config.string("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL"))));
const { effectApp } = makeEffectIt({
	clock: "live",
	layer: Layer.empty,
	makeHarness: (context) =>
		Effect.succeed({
			start: async (options: ServerOptions = {}) => {
				if (databaseUrl === undefined) {
					throw new Error("PostgreSQL URL is required");
				}
				const server = await startServer(databaseUrl, options);
				const views: Array<Awaited<ReturnType<typeof mountView>>> = [];
				context.onTestFinished(async () => {
					try {
						for (const view of views.reverse()) {
							await view.close();
						}
					} finally {
						await server.close();
					}
				});
				return {
					...server,
					mount: async () => {
						const view = await mountView(server.url);
						views.push(view);
						return view;
					},
				};
			},
		}),
});
export const integration = effectApp.skipIf(databaseUrl === undefined);
