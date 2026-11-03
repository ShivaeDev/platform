import { Effect, Queue, Schema } from "effect";
import { collection, readKeys } from "@shivaedev/changes/keys.ts";
import { withChangeCoverage } from "@shivaedev/test-kits/sql/testing.ts";
import { type ChangeDeclaration, changes } from "#changes.ts";
import type { AnnouncementOptions } from "#transact.ts";
import type { Body, Step } from "./body.ts";
import type { ChangeFeedEngine } from "./changeFeedEngine.ts";

export function rawWriterVerbs(engine: ChangeFeedEngine, tell: (line: string) => void) {
	const { other } = engine;
	function inFeed<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return engine.binding === undefined ? effect : Effect.provideContext(effect, engine.binding);
	}
	function rows() {
		const table = engine.tables.rows;
		return table === undefined ? Effect.die(new Error("Give the story the rows table first")) : Effect.succeed(table);
	}
	return {
		checkDeclaredCoverage: <TStep extends Step, A>(body: Body<TStep, A>, declaration: ChangeDeclaration) => {
			tell("coverage checks the raw writer's declaration against its writes");
			return inFeed(withChangeCoverage(Effect.gen(body), declaration)).pipe(
				Effect.as("covered"),
				Effect.catchTag("UnannouncedWrites", () => Effect.succeed("unannounced writes")),
			);
		},
		declareRowChange: (id: number, parent: number) =>
			Effect.map(rows(), ({ name }) => {
				tell(`the raw writer declares row ${id} and parent ${parent}`);
				const keys = collection(name, Schema.Number, { parent: Schema.Number });
				return changes({ [name]: [keys.item(id), keys.bucket.parent(parent)] });
			}),
		nextLiveRows: () =>
			Effect.suspend(() => {
				const results = engine.liveRows;
				return results === undefined ? Effect.die(new Error("Watch the rows first")) : Queue.take(results);
			}),
		recordRowChange: (declaration: ChangeDeclaration, options?: AnnouncementOptions) => {
			tell(`the raw writer records its declaration with ${options?.publication ?? "shared"} publication`);
			return inFeed(declaration.record(options));
		},
		watchRowsInParent: (parent: number) =>
			Effect.gen(function* () {
				tell(`a local live query reads rows under parent ${parent} from another connection`);
				const { name } = yield* rows();
				const keys = collection(name, Schema.Number, { parent: Schema.Number });
				engine.liveRows = yield* engine.reactivity.query(
					readKeys([keys.bucket.parent(parent)]),
					Effect.map(other<{ readonly id: number }>`select id from ${other(name)} where parent = ${parent} order by id`, (found) =>
						found.map(({ id }) => id),
					),
				);
			}),
	};
}
