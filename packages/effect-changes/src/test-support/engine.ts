import { type Deferred, Effect } from "effect";
import { type Channel, type ChannelOptions, makeChannel } from "#channel.ts";
import type { CommitFrame } from "#frame.ts";
import type { Observer } from "#observe.ts";
import type { Publish } from "#publish.ts";
import { type Change, Current, captureLogs, type FakeDatabase, makeDatabase } from "./fake-database.ts";

export type Options = Partial<ChannelOptions<Change, Current, string>>;

export interface Engine {
	readonly captured: Array<readonly string[]>;
	readonly channel: () => Channel<Change, Current, string>;
	readonly frames: Map<string, CommitFrame<string>>;
	gate: { committing: Deferred.Deferred<void>; release: Deferred.Deferred<void> } | undefined;
	readonly guarded: string[];
	readonly hooks: string[][];
	readonly logs: ReturnType<typeof captureLogs>;
	readonly observed: string[];
	observer: Observer<Change> | undefined;
	readonly options: Options;
	readonly owners: Map<string, FakeDatabase>;
	readonly published: Array<readonly string[]>;
	sink: Publish<Change> | undefined;
	readonly timeline: string[];
}

export function label(change: Change) {
	return `${change.subject}:${change.domain}`;
}

export function createEngine(): Engine {
	const published: Array<readonly string[]> = [];
	const options: Options = {};
	let channel: Channel<Change, Current, string> | undefined;
	return {
		captured: [],
		channel: () => {
			channel ??= makeChannel<Change, Current, string>({
				key: label,
				name: "Test",
				owner: Effect.service(Current),
				publish: (changes) => Effect.sync(() => published.push(changes.map(label))),
				...options,
			});
			return channel;
		},
		frames: new Map(),
		gate: undefined,
		guarded: [],
		hooks: [],
		logs: captureLogs(),
		observed: [],
		observer: undefined,
		options,
		owners: new Map([["main", makeDatabase("main")]]),
		published,
		sink: undefined,
		timeline: [],
	};
}

export function database(engine: Engine, name = "main") {
	const owner = engine.owners.get(name);
	if (owner === undefined) {
		throw new Error(`No transaction owner named ${name}`);
	}
	return owner;
}
