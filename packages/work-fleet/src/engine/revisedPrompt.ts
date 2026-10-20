import { Effect } from "effect";
import type { BoardGatewayService } from "#board/GatewayService.ts";
import { implementedGoals } from "#board/implementedGoals.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import { revisedTaskPrompt, TASK_HEADING } from "#prompt/task.ts";

export const revisedPrompt = Effect.fn("Fleet.revisedPrompt")(function* (record: FleetRecord, work: BoardWork, get: BoardGatewayService["get"]) {
	const goals = record.prompt.includes(`${TASK_HEADING}\n\n`) ? yield* implementedGoals(work, get) : undefined;
	return revisedTaskPrompt(record.prompt, record.boardContext, work.context, goals);
});
