import { Effect, Schema, SchemaGetter } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { contract } from "#contract.ts";
import { makeClient } from "#makeClient.ts";
import { command } from "#operation.ts";

const Range = Schema.Struct({ end: Schema.NumberFromString, start: Schema.NumberFromString }).check(
	Schema.makeFilter(({ end, start }) => start < end, { message: "Start must precede end" }),
);
const Save = command("save", { invalidates: () => [], payload: Range, rejections: { BadRequest }, success: Schema.String });
const SaveEncoded = command("saveEncoded", {
	invalidates: () => [],
	payload: Range.pipe(
		Schema.decodeTo(Schema.Struct({ end: Schema.Number, start: Schema.Number }), {
			decode: SchemaGetter.passthrough(),
			encode: SchemaGetter.passthrough(),
		}),
	),
	rejections: { BadRequest },
	success: Schema.String,
});
const Api = contract("ranges", { commands: [Save, SaveEncoded] });

export const encodeStory = storyKit({
	clock: "test",
	*create() {
		const received: (typeof Range.Type)[] = [];
		function receive(range: typeof Range.Type) {
			return Effect.sync(() => {
				received.push(range);
				return `${range.start} to ${range.end}`;
			});
		}
		const handlers = Api.application.toLayer({
			"ranges.save": receive,
			"ranges.saveEncoded": receive,
		});
		const connection = makeClient({ api: Api }, { protocol: layerLiveMemoryProtocol(Api, handlers), url: "memory://ranges" });
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(value) => Effect.sync(() => value.dispose()),
		);
		return { connection, received, registry };
	},
	inspect: ({ received }) => ({ received }),
	name: "command payload encoding",
	stages: [],
	verbs: ({ connection, received, registry }, story) => ({
		received: () => [...received],
		save: (operation: "save" | "saveEncoded", start: number, end: number) => {
			story.tell(`save the range ${start} to ${end}`);
			return AtomRegistry.getResult(registry, connection.runtime.atom(connection.api.api[operation].run({ end, start }))).pipe(
				Effect.catchTag("BadRequest", (error) =>
					Effect.succeed({ message: error.message, refusal: error instanceof BadRequest ? "BadRequest" : "undecoded" }),
				),
			);
		},
	}),
});
