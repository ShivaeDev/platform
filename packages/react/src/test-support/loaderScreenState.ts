import type { AnyRouter } from "@tanstack/react-router";
import type { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import type { loaderHost } from "./loaderHost.ts";
import { settleScreen } from "./settleScreen.ts";

type Host = Effect.Success<ReturnType<typeof loaderHost>>;

export interface Engine {
	readonly host: Host;
	readonly loaded: PromiseWithResolvers<void>;
	readonly mount: PromiseWithResolvers<void>;
	readonly mountGate: { wait: (registry: AtomRegistry.AtomRegistry) => Promise<void> };
	pending?: () => boolean;
	registry?: AtomRegistry.AtomRegistry;
	readonly renders: string[];
	router?: AnyRouter;
	view?: Rendered;
}

export function sessionRegistry(engine: Engine) {
	if (engine.registry === undefined) {
		throw new Error("No session registry");
	}
	return engine.registry;
}

export function opened(engine: Engine) {
	if (engine.view === undefined || engine.router === undefined || engine.pending === undefined) {
		throw new Error("The note screen is not open");
	}
	return { pending: engine.pending, router: engine.router, view: engine.view };
}

export function settle(engine: Engine, tell: (line: string) => void) {
	const { pending, view } = opened(engine);
	return settleScreen(view.container, pending, tell);
}
