import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { routeQueryOptions } from "#client/react/routeQuery.ts";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { matchingCommands, needsYouCommands, type SearchItem } from "#client/react/searchCommands.ts";

export function usePaletteCommands(api: ShellApi, text: string): readonly SearchItem[] {
	const goals = useQuery(api.goals.query());
	const inbox = useQuery(api.inbox.query(undefined, routeQueryOptions));
	const needsYou = text ? [] : needsYouCommands(Option.getOrUndefined(inbox.data));
	return [...needsYou, ...matchingCommands(Option.getOrUndefined(goals.data)?.goals ?? [], text)];
}
