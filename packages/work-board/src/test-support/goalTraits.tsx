import { DocumentMain } from "#client/react/DocumentMain.tsx";
import { goalFleetFixture } from "./goalPageFixture.ts";
import { boardScreen } from "./screenTraits.ts";
import { screenFleet } from "./screenWorkspaceTraits.ts";

type GoalFleet = ReturnType<typeof goalFleetFixture>;

export function goalFleetReports(stage: Parameters<typeof goalFleetFixture>[0], change: (fleet: GoalFleet) => GoalFleet = (fleet) => fleet) {
	const fleet = change(goalFleetFixture(stage));
	return screenFleet({
		...fleet,
		completed: fleet.completed.map((item) => ({ ...item, document: null })),
		items: fleet.items.map((item) => ({ ...item, document: null })),
	});
}

export function goalDocumentScreen(workspace: Readonly<Record<string, string>>) {
	return boardScreen(workspace, (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />);
}
