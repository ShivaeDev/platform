import { Effect } from "effect";
import type { BoardGatewayService } from "#board/GatewayService.ts";
import { revisedPrompt } from "#engine/revisedPrompt.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import { TASK_HEADING, taskPrompt } from "#prompt/task.ts";

export const reviewContext = Effect.fn("Fleet.reviewContext")(function* (record: FleetRecord, work: BoardWork, get: BoardGatewayService["get"]) {
	const prompt = yield* revisedPrompt(record, work, get);
	const task = prompt.indexOf(`${TASK_HEADING}\n\n`);
	return [task < 0 ? "" : prompt.slice(0, task).trim(), TASK_HEADING, taskPrompt(work.context)].filter(Boolean).join("\n\n");
});
