import { fleetWorkspace } from "./fleetWorkspaceFixture.ts";
import { routedScreen } from "./screenTraits.ts";

export function workTableScreen(route: string) {
	return routedScreen(fleetWorkspace, route, { home: "home.md" });
}
