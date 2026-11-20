import { RegistryContext } from "@effect/atom-react";
import { type AnyRouter, type RegisteredRouter, type RouterProps, RouterProvider as TanStackRouterProvider } from "@tanstack/react-router";
import { createElement, useContext, useEffect, useLayoutEffect, useRef } from "react";
import { firstRoutesPending } from "#firstRoutesPending.ts";

export function RouterProvider<TRouter extends AnyRouter = RegisteredRouter, TDehydrated extends Record<string, unknown> = Record<string, unknown>>(
	props: RouterProps<TRouter, TDehydrated>,
) {
	const registry = useContext(RegistryContext);
	const { router } = props;
	const holdRef = useRef<() => void>(undefined);
	// A layout effect holds the reveal before any passive effect of this commit, such as useFirstSettled's above this provider, runs.
	useLayoutEffect(() => {
		if (router.state.resolvedLocation !== undefined) {
			return;
		}
		let held = true;
		registry.update(firstRoutesPending, (pending) => pending + 1);
		function release() {
			if (held) {
				held = false;
				registry.update(firstRoutesPending, (pending) => pending - 1);
			}
		}
		const stop = router.subscribe("onRendered", release);
		const previous = holdRef.current;
		holdRef.current = () => {
			stop();
			release();
		};
		previous?.();
	}, [registry, router]);
	// StrictMode replays every layout cleanup before any passive one; releasing in a passive cleanup, after useFirstSettled above has stopped listening, keeps the replay from revealing.
	useEffect(
		() => () => {
			holdRef.current?.();
			holdRef.current = undefined;
		},
		[],
	);
	return createElement(TanStackRouterProvider<TRouter, TDehydrated>, props);
}
