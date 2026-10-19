import type { Navigation } from "#browser/Navigation.ts";
import { useNeedsYouCount } from "./useNeedsYouCount.ts";

// Until the first navigation read settles, the count is still loading rather than unavailable.
export function useShownInboxCount(navigation: Navigation | undefined, settled: boolean): number | null | undefined {
	const count = useNeedsYouCount(navigation);
	if (count !== undefined) {
		return count;
	}
	return settled ? null : undefined;
}
