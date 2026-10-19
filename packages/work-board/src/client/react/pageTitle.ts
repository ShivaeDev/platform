import { documentTitle } from "./documentRoute.ts";
import type { ProjectionRoute } from "./projectionRoute.ts";
import type { RemainingRoute } from "./remainingRoute.ts";

export function pageTitle(route: ProjectionRoute | RemainingRoute, url: string) {
	switch (route) {
		case "pull-requests":
			return "Pull requests";
		case "board":
			return documentTitle(url);
		case "today":
			return "Today";
		case "work":
			return "Now";
		case "goals":
			return "Goals";
		case "library":
			return "Library";
		case "system":
			return "System";
		case "start":
			return "Getting started";
		case "handoff":
			return "Hand off to an agent";
	}
}
