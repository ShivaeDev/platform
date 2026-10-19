import { useContext } from "react";
import { readyToMergeCount } from "#browser/views/pullRequests.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { FleetItemsContext } from "#client/react/FleetItemsContext.ts";

export function MergeCount() {
	const count = readyToMergeCount(useContext(FleetItemsContext));
	return count === undefined ? null : (
		<Badge aria-label={`${count} ready to merge`} role="status" variant="secondary">
			{count}
		</Badge>
	);
}
