import { Context, type Effect } from "effect";
import type { BoardWork, FleetFailure } from "#policy.ts";

export class ReportInspection extends Context.Service<
	ReportInspection,
	{
		readonly check: (work: BoardWork) => Effect.Effect<void, FleetFailure>;
	}
>()("@shivaedev/work-fleet/ReportInspection") {}
