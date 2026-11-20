import { useAtomValue } from "@effect/atom-react";
import { type ActiveClient, clientActivity } from "@shivaedev/contract/clientActivity.ts";

export function useFirstSettled(client: ActiveClient): boolean {
	return useAtomValue(clientActivity(client).firstSettled);
}
