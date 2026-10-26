import { Clock, Effect, Schedule, Stream } from "effect";
import { ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";
import { watchChanges } from "#server/files/changes.ts";
import { responseIndex } from "#server/responseIndex.ts";
import { type Snapshot, searchSnapshot } from "#server/search/snapshot.ts";

function feedRecords(data: Snapshot) {
	const index = responseIndex(data.model);
	if (data.unavailable.length > 0 || index.malformed) {
		return Effect.fail(new ServiceUnavailable({ message: "Response feed is incomplete or malformed. Check the source diagnostics and retry." }));
	}
	const records = [...index.questions.values()].flatMap((question) =>
		index.responsesFor(question).responses.map((response) => ({ question, response })),
	);
	records.sort((a, b) => a.response.response.recordedAt - b.response.response.recordedAt || a.response.id.localeCompare(b.response.id));
	return Effect.succeed(records);
}

export function responseFeed(root: string, since?: number) {
	return Stream.unwrap(
		Effect.gen(function* () {
			const start = since ?? (yield* Clock.currentTimeMillis);
			const changes = yield* watchChanges(root);
			const snapshot = yield* searchSnapshot(root, undefined, changes);
			const seen = new Set<string>();
			const read = Effect.gen(function* () {
				const data = yield* snapshot;
				const records = yield* feedRecords(data);
				const lines: string[] = [];
				for (const { question, response } of records) {
					if (response.response.recordedAt < start || seen.has(response.id)) {
						continue;
					}
					if (data.model.ids.get(question.id)?.length !== 1 || data.model.ids.get(response.id)?.length !== 1) {
						return yield* Effect.fail(
							new ServiceUnavailable({ message: "Response feed includes ambiguous identities. Give each record a unique ID and retry." }),
						);
					}
					seen.add(response.id);
					lines.push([question.question.item, question.question.request, response.id, response.body.split(/\r?\n/u)[0] ?? ""].join("\t"));
				}
				return lines;
			});
			return Stream.fromEffectSchedule(read, Schedule.spaced("100 millis")).pipe(Stream.flattenIterable);
		}),
	);
}
