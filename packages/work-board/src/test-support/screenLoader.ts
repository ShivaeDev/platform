import { Effect } from "effect";
import type { ScreenEngine } from "./screenEngine.ts";

interface LoaderObservation {
	readonly failed: PromiseWithResolvers<unknown>;
	readonly started: PromiseWithResolvers<void>;
}
const observations = new WeakMap<ScreenEngine, LoaderObservation>();

export function observeLoader(engine: ScreenEngine, url: string) {
	if (!engine.router) {
		throw new Error("The screen has no router");
	}
	const observation = { failed: Promise.withResolvers<unknown>(), started: Promise.withResolvers<void>() };
	observations.set(engine, observation);
	const route = engine.router.routesById["/$"];
	const loader = route.options.loader;
	if (typeof loader !== "function") {
		throw new Error("The document route has no loader");
	}
	type LoaderContext = Extract<Parameters<typeof loader>[0], { readonly params: unknown }>;
	route.options.loader = async (context: LoaderContext) => {
		if (context.location.href !== url) {
			return loader(context);
		}
		observation.started.resolve();
		try {
			return await loader(context);
		} catch (error) {
			observation.failed.resolve(error);
			throw error;
		}
	};
}

export function loaderObservations(engine: ScreenEngine, tell: (line: string) => void) {
	function observation() {
		const current = observations.get(engine);
		if (!current) {
			throw new Error("The story does not observe a loader");
		}
		return current;
	}
	return {
		loaderFailure: () => {
			tell("the reader reads why the canceled loader stopped");
			return Effect.map(
				Effect.promise(() => observation().failed.promise),
				(failure) =>
					failure instanceof Error
						? `${failure.name}: ${failure.cause instanceof Error ? failure.cause.message : String(failure.cause)}`
						: String(failure),
			);
		},
		loaderStarted: () => {
			tell("the router starts loading the destination");
			return Effect.promise(() => observation().started.promise);
		},
	};
}
