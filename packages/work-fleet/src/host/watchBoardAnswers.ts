import { Effect, Schedule, Stream } from "effect";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import type { Snapshot } from "@shivaedev/work-board/server/search/snapshot.ts";

export function watchBoardAnswers(root: string) {
	return Stream.unwrap(
		Effect.gen(function* () {
			const changes = yield* board.watchChanges(root);
			const snapshot = yield* board.searchSnapshot(root, undefined, changes);
			function read(data: Snapshot) {
				return Effect.gen(function* () {
					const questions = responses.openQuestions(data);
					const readings = yield* Effect.forEach(questions, (question) => responses.readResponses(Effect.succeed(data))(question.id));
					return readings.flatMap(({ question, responses: recorded }) => {
						const attention = board.metadataParse(question.context).fields.attention?.find((request) => request.id === question.question.request);
						const unblocks = attention?.unblocks ?? [];
						const external = recorded.filter((response) => response.response.author !== "orchestrator");
						return external.map((response) => ({
							author: response.response.author,
							item: question.question.item,
							kind: "board-answer" as const,
							question: question.id,
							reason: question.question.reason,
							recordedAt: response.response.recordedAt,
							request: question.question.request,
							responseId: response.id,
							unblocks,
							workId: unblocks[0] ?? question.question.item,
						}));
					});
				});
			}
			return Stream.fromEffectSchedule(snapshot, Schedule.spaced("100 millis")).pipe(
				Stream.changesWith((left, right) => left === right),
				Stream.mapEffect(read),
				Stream.changesWith((left, right) => JSON.stringify(left) === JSON.stringify(right)),
				Stream.map((answers) => ({ answers })),
			);
		}),
	);
}
