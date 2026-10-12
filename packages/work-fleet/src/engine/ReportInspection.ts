import { Context, type Effect } from "effect";
import type { FleetError } from "#errors.ts";
import type { BoardWork } from "#policy.ts";

export class ReportInspection extends Context.Service<
	ReportInspection,
	{
		readonly check: (work: BoardWork) => Effect.Effect<void, FleetError>;
	}
>()("@shivaedev/work-fleet/ReportInspection") {}
