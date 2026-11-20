import { useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import { useEffect } from "react";
import { type ActiveClient, clientActivity } from "@shivaedev/contract/clientActivity.ts";

export function useFirstSettled(client: ActiveClient): boolean {
	const activity = clientActivity(client);
	useEffect(() => {
		Effect.runSync(activity.rendered);
	}, [activity]);
	return useAtomValue(activity.firstSettled);
}
