import { type AnyRouteMatch, type AnyRouter, useMatch, useRouter } from "@tanstack/react-router";
import { Cause, Predicate } from "effect";
import { type ComponentType, createContext, createElement, type ReactNode, useContext } from "react";
import { failureKind } from "@shivaedev/contract/failureKind.ts";
import { isForbidden } from "@shivaedev/errors/taxonomy.ts";
import { useQueryRetry } from "#adapters/useQueryRetry.ts";
import { decide } from "#client/failureDecision.ts";
import type { FailureChoices } from "#client/failures.ts";
import { type FailureLayout, FailureMessage } from "#client/QueryView.ts";
import { useFailureWording } from "#client/useFailureWording.ts";
import { PermissionContext } from "#PermissionContext.ts";

export const LoadFailureContext = createContext<ComponentType<FailureLayout>>(FailureMessage);

function routeOptions(router: AnyRouter, routeId: string): unknown {
	return router.routesById[routeId]?.options;
}

// A route spread from `queryRoute` carries its query's refresh and failure handlers in its options; any other route's loader simply runs again.
function refreshRouteQuery(router: AnyRouter, match: AnyRouteMatch): void {
	const options = routeOptions(router, match.routeId);
	if (Predicate.hasProperty(options, "refreshQuery") && Predicate.isFunction(options.refreshQuery)) {
		options.refreshQuery(match);
	}
}

function routeFailures(router: AnyRouter, routeId: string): FailureChoices["failures"] {
	const options = routeOptions(router, routeId);
	return Predicate.hasProperty(options, "queryFailures") && Predicate.isObject(options.queryFailures) ? options.queryFailures : undefined;
}

function noField(): undefined {
	return undefined;
}

// A loader that failed shows the application's one failure screen. A rejection the app declared reads as the route's handler words its
// refresh notice and offers no Retry, since the server would give the same answer; anything else is worded as a notice would be and can be
// read again. A refusal shows the forbidden screen, and an error thrown while rendering reaches the application.
export function RouteLoadFailure({ error }: { readonly error: unknown }): ReactNode {
	const permission = useContext(PermissionContext);
	const screen = useContext(LoadFailureContext);
	const router = useRouter<AnyRouter>();
	const loadFailed = useMatch({ select: (match) => match.status === "error" && match.error === error, strict: false });
	const routeId = useMatch({ select: (match) => match.routeId, strict: false });
	const retrying = useMatch({ select: (match) => match.isFetching !== false, strict: false });
	const retry = useQueryRetry((match) => refreshRouteQuery(router, match));
	const word = useFailureWording();
	if (isForbidden(error)) {
		return permission?.fallback;
	}
	if (!loadFailed) {
		throw error;
	}
	if (failureKind(error) === "app") {
		const decision = decide<never>(error, undefined, { failures: routeFailures(router, routeId) }, noField);
		return createElement(screen, { message: decision._tag === "notice" ? decision.descriptor.message : word(Cause.fail(error)), retrying });
	}
	return createElement(screen, {
		message: word(Cause.fail(error)),
		retry: () => {
			void retry();
		},
		retrying,
	});
}
