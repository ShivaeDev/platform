import { useAtomValue } from "@effect/atom-react";
import type { Navigation } from "#browser/Navigation.ts";
import { savedAnswers } from "./savedAnswers.ts";

export function useNeedsYouCount(navigation: Navigation | undefined) {
	const saved = useAtomValue(savedAnswers);
	const count = navigation?.inboxCount;
	if (count === undefined || count === null) {
		return count;
	}
	return Math.max(0, count - saved.filter((entry) => entry.navigation === navigation).length);
}
