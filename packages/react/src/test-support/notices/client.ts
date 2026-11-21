import { Deferred, Effect } from "effect";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { Api, Rejected, type Removed, TitleRejected } from "#test/notices/Api.ts";
import { settledBeside } from "#test/settledBeside.ts";

export type HeldKind = "remove" | "restore" | "save";

interface Held {
	readonly arrived: Deferred.Deferred<void>;
	readonly finished: Deferred.Deferred<void>;
	readonly gate: Deferred.Deferred<void>;
}

export function noticeClient(options: { readonly holdReads?: boolean } = {}) {
	const held = new Map<string, Held>();
	const arrivals: Record<HeldKind, string[]> = { remove: [], restore: [], save: [] };
	const reads: Deferred.Deferred<void, Rejected>[] = [];
	const readers = new Set<() => void>();
	const versions = new Map<string, number>();
	const restored: string[] = ["existing"];
	let failReads = false;
	const calls: { title: string; expectedVersion: number }[] = [];
	const released: string[] = [];
	function hold(kind: HeldKind, title: string) {
		const key = `${kind} ${title}`;
		const existing = held.get(key);
		if (existing) {
			return existing;
		}
		const created: Held = { arrived: Deferred.makeUnsafe(), finished: Deferred.makeUnsafe(), gate: Deferred.makeUnsafe() };
		held.set(key, created);
		return created;
	}
	function arrive<A, E>(kind: HeldKind, title: string, work: (gate: Effect.Effect<void>) => Effect.Effect<A, E>) {
		const { arrived, finished, gate } = hold(kind, title);
		return Effect.suspend(() => {
			arrivals[kind].push(title);
			Deferred.doneUnsafe(arrived, Effect.void);
			return work(Deferred.await(gate));
		}).pipe(Effect.ensuring(Effect.sync(() => Deferred.doneUnsafe(finished, Effect.void))));
	}
	function nextRead() {
		return new Promise<void>((resolve) => {
			function reader() {
				readers.delete(reader);
				resolve();
			}
			readers.add(reader);
		});
	}
	function list() {
		return Effect.gen(function* () {
			if (options.holdReads) {
				const pending = yield* Deferred.make<void, Rejected>();
				reads.push(pending);
				for (const reader of [...readers]) {
					reader();
				}
				yield* Deferred.await(pending);
			}
			return yield* failReads ? Effect.fail(new Rejected()) : Effect.succeed(restored.join(", "));
		});
	}
	function save({ title }: { readonly title: string }) {
		return arrive("save", title, (gate) =>
			Effect.gen(function* () {
				if (title === "blocked") {
					return yield* Effect.fail(new TitleRejected({ field: "title", message: "Choose another title" }));
				}
				yield* gate;
				restored.push(title);
				return title;
			}),
		);
	}
	function removeRow({ title }: { readonly title: string }) {
		return arrive("remove", title, (gate) =>
			Effect.gen(function* () {
				if (title === "blocked") {
					return yield* Effect.fail(new Rejected());
				}
				yield* gate;
				const expectedVersion = (versions.get(title) ?? 7) + 1;
				versions.set(title, expectedVersion);
				return { expectedVersion, title };
			}),
		);
	}
	function restoreRow(input: typeof Removed.Type) {
		return arrive("restore", input.title, (gate) =>
			Effect.gen(function* () {
				calls.push(input);
				yield* gate;
				const current = versions.get(input.title) ?? 7;
				if (current !== input.expectedVersion) {
					return yield* Effect.fail(new Conflict({ message: `Expected version ${input.expectedVersion}, found ${current}` }));
				}
				restored.push(`${input.title}@${current + 1}`);
				versions.set(input.title, current + 1);
				return `Restored ${input.title}`;
			}).pipe(
				Effect.ensuring(
					Effect.sync(() => {
						released.push(input.title);
					}),
				),
			),
		);
	}
	const handlers = Api.application.toLayer(
		Effect.succeed(
			Api.application.of({
				"notices.breakReads": () =>
					Effect.sync(() => {
						failReads = true;
					}),
				"notices.edit": ({ title }) =>
					Effect.sync(() => {
						versions.set(title, (versions.get(title) ?? 7) + 1);
					}),
				"notices.list": list,
				"notices.remove": removeRow,
				"notices.restore": restoreRow,
				"notices.save": save,
			}),
		),
	);
	const connection = makeClient({ api: Api }, { protocol: layerLiveMemoryProtocol(Api, handlers), url: "memory://notices" });
	const settled = settledBeside(() => ({
		awaitingReruns: reads.some((read) => !Deferred.isDoneUnsafe(read)) ? undefined : 0,
		commands: [...held.values()].filter(({ arrived, finished }) => Deferred.isDoneUnsafe(arrived) && !Deferred.isDoneUnsafe(finished)).length,
	}));
	return {
		activity: clientActivity(connection),
		api: connection.api.api,
		arrivals,
		calls,
		hold,
		nextRead,
		reads,
		released,
		runtime: connection.Client.runtime,
		settled,
	};
}
export type NoticeClient = ReturnType<typeof noticeClient>;
