import { Effect, PubSub, Stream } from "effect";
import { board, type Snapshot } from "@shivaedev/work-board/server/integration/board.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import { BoardIndex } from "#board/Index.ts";

export function watchBoardAnswers(root: string) {
	return Stream.unwrap(
		Effect.gen(function* () {
			const shared = yield* Effect.serviceOption(BoardIndex);
			const index = shared._tag === "Some" ? shared.value.index : yield* board.watchIndex(root);
			const events = yield* PubSub.subscribe(index.changes.events);
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
			return Stream.fromEffect(index.read)
				.pipe(Stream.concat(Stream.fromSubscription(events).pipe(Stream.mapEffect(() => index.read))))
				.pipe(
					Stream.changesWith((left, right) => left === right),
					Stream.mapEffect(read),
					Stream.changesWith((left, right) => JSON.stringify(left) === JSON.stringify(right)),
					Stream.map((answers) => ({ answers })),
				);
		}),
	);
}
