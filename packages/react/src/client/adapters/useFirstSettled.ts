import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import { useContext, useEffect } from "react";
import { type ActiveClient, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { firstRoutesPending } from "#client/firstRoutes.ts";

export function useFirstSettled(client: ActiveClient): boolean {
	const activity = clientActivity(client);
	const registry = useContext(RegistryContext);
	useEffect(
		() =>
			registry.subscribe(
				firstRoutesPending,
				(pending) => {
					if (pending === 0) {
						Effect.runSync(activity.rendered);
					}
				},
				{ immediate: true },
			),
		[activity, registry],
	);
	return useAtomValue(activity.firstSettled);
}
