import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { implementedGoals } from "#board/implementedGoals.ts";
import { type FleetHost, HostFailure } from "#host/config.ts";
import { MainSource } from "#host/mainSource.ts";
import { BoardGateway, type BoardWork } from "#policy.ts";
import { goalPrompt, TASK_HEADING, taskPrompt } from "#prompt/task.ts";
import { workerPrompt } from "#prompt/worker.ts";

export const workerBrief = Effect.fn("FleetHost.workerBrief")(
	function* (work: BoardWork) {
		const goals = yield* implementedGoals(work, (yield* BoardGateway).get);
		const fs = yield* FileSystem.FileSystem;
		const readme = join((yield* MainSource).repositoryRoot, "README.md");
		const source = (yield* fs.exists(readme)) ? yield* fs.readFileString(readme) : "";
		const summary = source
			.split(/\n\s*\n/u)
			.find((paragraph) => /^[\p{L}\p{N}]/u.test(paragraph.trim()))
			?.trim()
			.replaceAll(/\s*\n\s*/gu, " ");
		return [summary, goalPrompt(goals), TASK_HEADING, taskPrompt(work.context)].filter((part) => part).join("\n\n");
	},
	Effect.mapError((error) => (error._tag === "BoardFailure" ? error : new HostFailure({ message: error.message }))),
);

export const launchPrompt = Effect.fn("FleetHost.launchPrompt")(function* (host: FleetHost, work: BoardWork) {
	return host.provider === "cloud" && host.worker !== undefined
		? workerPrompt({
				branch: `${host.worker.branchPrefix}${work.workId}`,
				deliverable: work.deliverable,
				sharedEnvironment: host.worker.sharedEnvironment,
				task: yield* workerBrief(work),
				workId: work.workId,
			})
		: work.context;
});
