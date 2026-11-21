import { type AnyRouteMatch, type AnyRouter, useMatch, useRouter } from "@tanstack/react-router";
import { Cause, Predicate } from "effect";
import { type ComponentType, createContext, createElement, type ReactNode, useContext } from "react";
import { isForbidden } from "@shivaedev/errors/taxonomy.ts";
import { useQueryRetry } from "#adapters/useQueryRetry.ts";
import { type FailureLayout, FailureMessage } from "#client/QueryView.ts";
import { useFailureWording } from "#client/useFailureWording.ts";
import { PermissionContext } from "#PermissionContext.ts";

export const LoadFailureContext = createContext<ComponentType<FailureLayout>>(FailureMessage);

// A route spread from `queryRoute` carries its query's refresh in its options; any other route's loader simply runs again.
function refreshRouteQuery(router: AnyRouter, match: AnyRouteMatch): void {
	const options: unknown = router.routesById[match.routeId]?.options;
	if (Predicate.hasProperty(options, "refreshQuery") && Predicate.isFunction(options.refreshQuery)) {
		options.refreshQuery(match);
	}
}

// A loader that failed shows the application's one failure screen, worded as a notice would be; a refusal shows the forbidden screen, and an
// error thrown while rendering reaches the application.
export function RouteLoadFailure({ error }: { readonly error: unknown }): ReactNode {
	const permission = useContext(PermissionContext);
	const screen = useContext(LoadFailureContext);
	const router = useRouter<AnyRouter>();
	const loadFailed = useMatch({ select: (match) => match.status === "error" && match.error === error, strict: false });
	const retrying = useMatch({ select: (match) => match.isFetching !== false, strict: false });
	const retry = useQueryRetry((match) => refreshRouteQuery(router, match));
	const word = useFailureWording();
	if (isForbidden(error)) {
		return permission?.fallback;
	}
	if (!loadFailed) {
		throw error;
	}
	return createElement(screen, {
		message: word(Cause.fail(error)),
		retry: () => {
			void retry();
		},
		retrying,
	});
}
