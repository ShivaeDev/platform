import { RegistryContext } from "@effect/atom-react";
import { type AnyRouter, type RegisteredRouter, type RouterProps, RouterProvider as TanStackRouterProvider } from "@tanstack/react-router";
import { createElement, useContext, useLayoutEffect } from "react";
import { firstRoutesPending } from "#firstRoutesPending.ts";

export function RouterProvider<TRouter extends AnyRouter = RegisteredRouter, TDehydrated extends Record<string, unknown> = Record<string, unknown>>(
	props: RouterProps<TRouter, TDehydrated>,
) {
	const registry = useContext(RegistryContext);
	const { router } = props;
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
		return () => {
			stop();
			release();
		};
	}, [registry, router]);
	return createElement(TanStackRouterProvider<TRouter, TDehydrated>, props);
}
