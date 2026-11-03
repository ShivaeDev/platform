import * as Effect from "effect/Effect";
import type { ReactNode } from "react";

export const mountApp = Effect.fn("BrowserStory.mountApp")(function* <A, E, R>(options: {
	readonly create: Effect.Effect<A, E, R>;
	readonly render: (app: A) => ReactNode;
}) {
	const app = yield* options.create;
	const { render } = yield* Effect.promise(() => import("#client/adapters/react.ts"));
	const view = yield* Effect.acquireRelease(
		Effect.promise(() => render(options.render(app))),
		(mounted) => Effect.promise(mounted.unmount),
	);
	return { app, ...view };
});
