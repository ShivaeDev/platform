import { Effect } from "effect";
import { Workspace } from "#server/workspace.ts";
import { fleetItems } from "./fleetItems.ts";
import { goals } from "./goals.ts";

export const overview = Effect.fn("WorkBoard.overview")(function* (folder: string, fleetPort?: number | null) {
	const workspace = yield* Workspace;
	const snapshot = yield* workspace.index();
	const fleet = yield* fleetItems(folder, fleetPort).pipe(Effect.provideService(Workspace, { ...workspace, index: () => Effect.succeed(snapshot) }));
	return { fleet, goals: goals(snapshot, fleet) };
});
