import { Clock, Effect, Schedule } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { Fleet } from "#fleet.ts";
import { answerRecords } from "#host/answerRecords.ts";
import { answerRequests } from "#host/answerRequests.ts";
import { answerWork } from "#host/answerWork.ts";
import { resolveHost } from "#host/config.ts";
import { decisionResponses } from "#host/releaseWork.ts";
import { BoardGateway } from "#policy.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";
import { openFleetBoard } from "#test/withFleetBoard.ts";

export function engineHostAnswers(state: EngineStory, tell: (line: string) => void) {
	return {
		answerFromHost: (workId: string, text: string, release = false) =>
			Effect.gen(function* () {
				tell(`answer ${workId} through the host and await application`);
				if (state.root === "") {
					return yield* Effect.die("Host answers require a Markdown Board");
				}
				const host = resolveHost(state.root, { database: syntheticDatabase, namespace: STORAGE_NAMESPACE, provider: "local" });
				const board = yield* openFleetBoard(state.root);
				const accept = yield* answerRequests(host, (id, options) =>
					answerWork(host, id, { ...options, background: true }).pipe(
						Effect.provide(decisionResponses(host)),
						Effect.provideService(BoardGateway, board),
					),
				);
				yield* accept(workId, text, release);
				return yield* answerRecords(STORAGE_NAMESPACE, workId).pipe(
					Effect.map((records) => records[0]),
					Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: (record) => record?.blocker !== ANSWER_RECORDED }),
					Effect.timeout("5 seconds"),
				);
			}).pipe(
				Effect.provideService(Fleet, running(state).fleet),
				Effect.provide(state.logs.layer),
				Effect.provideService(Clock.Clock, Clock.Clock.defaultValue()),
			),
	};
}
