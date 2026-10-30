import { Cause, type Deferred, Effect, Exit, type Fiber, Option } from "effect";
import { type Channel, type ChannelOptions, makeChannel } from "#channel.ts";
import { type Change, Current, captureLogs, type FakeDatabase, label, makeDatabase } from "./fakeDatabase.ts";

type Configured = ChannelOptions<Change, Current, string>;

export type Options = { -readonly [TOption in keyof Configured]?: Configured[TOption] };

export type TransactionEnding = "rejected" | "died" | "interrupted" | "commit failed";

export type BatchEnding = "succeeds" | "fails" | "is interrupted";

export const COMMIT_REFUSED = "the database refused the commit";

export interface Engine {
	batchEnding: BatchEnding;
	readonly channel: () => Channel<Change, Current, string>;
	commitGate: { readonly begun: Deferred.Deferred<void>; readonly release: Deferred.Deferred<void> } | undefined;
	readonly committedSink: string[][];
	readonly guardAsked: string[];
	readonly hookCalls: string[];
	inFlight: Fiber.Fiber<void, unknown> | undefined;
	readonly logs: ReturnType<typeof captureLogs>;
	readonly observed: string[];
	readonly options: Options;
	order: Exit.Exit<unknown, unknown> | undefined;
	readonly owners: Map<string, FakeDatabase>;
	readonly published: string[][];
	readonly scopedSink: string[][];
	straggler: { readonly fiber: Fiber.Fiber<void, unknown>; readonly release: Deferred.Deferred<void> } | undefined;
	stragglerExit: Exit.Exit<unknown, unknown> | undefined;
	readonly timeline: string[];
	transactionEnding: TransactionEnding | undefined;
}

export function labels(changes: readonly Change[]) {
	return changes.map(label);
}

export function createEngine(): Engine {
	const published: string[][] = [];
	const timeline: string[] = [];
	const options: Options = {};
	let channel: Channel<Change, Current, string> | undefined;
	return {
		batchEnding: "succeeds",
		channel: () => {
			channel ??= makeChannel<Change, Current, string>({
				key: label,
				name: "Test",
				owner: Effect.service(Current),
				publish: (changes) =>
					Effect.sync(() => {
						published.push(labels(changes));
						timeline.push(`the sink receives ${labels(changes).join(", ")}`);
					}),
				...options,
			});
			return channel;
		},
		commitGate: undefined,
		committedSink: [],
		guardAsked: [],
		hookCalls: [],
		inFlight: undefined,
		logs: captureLogs(),
		observed: [],
		options,
		order: undefined,
		owners: new Map([["main", makeDatabase("main")]]),
		published,
		scopedSink: [],
		straggler: undefined,
		stragglerExit: undefined,
		timeline,
		transactionEnding: undefined,
	};
}

export function database(engine: Engine, name: string) {
	const owner = engine.owners.get(name);
	if (owner === undefined) {
		throw new Error(`No database named ${name}; declare it with hasOwner("${name}")`);
	}
	return owner;
}

export function endingOf(exit: Exit.Exit<unknown, unknown> | undefined): string {
	if (exit === undefined) {
		return "not started";
	}
	if (Exit.isSuccess(exit)) {
		return "committed";
	}
	if (Cause.hasDies(exit.cause)) {
		return Cause.pretty(exit.cause).includes(COMMIT_REFUSED) ? "commit failed" : "died";
	}
	const failure = Cause.findErrorOption(exit.cause);
	return Option.isSome(failure) ? String(failure.value) : "interrupted";
}

export function defectOf(exit: Exit.Exit<unknown, unknown> | undefined): string | undefined {
	return exit !== undefined && Exit.isFailure(exit) && Cause.hasDies(exit.cause) ? Cause.pretty(exit.cause) : undefined;
}
