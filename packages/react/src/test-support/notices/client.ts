import { Deferred, Effect, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { Api, Conflict, Rejected, type Removed, TitleRejected } from "./Api.ts";

export function noticeClient(options: { readonly holdReads?: boolean } = {}) {
	const removals = new Map<string, Deferred.Deferred<void>>();
	const restores = new Map<string, Deferred.Deferred<void>>();
	const saves = new Map<string, Deferred.Deferred<void>>();
	const reads: Deferred.Deferred<void, Rejected>[] = [];
	const versions = new Map<string, number>();
	const restored: string[] = ["existing"];
	let failReads = false;
	const calls: { title: string; expectedVersion: number }[] = [];
	const released: string[] = [];
	function list() {
		return Effect.gen(function* () {
			if (options.holdReads) {
				const pending = yield* Deferred.make<void, Rejected>();
				reads.push(pending);
				yield* Deferred.await(pending);
			}
			return yield* failReads ? Effect.fail(new Rejected()) : Effect.succeed(restored.join(", "));
		});
	}
	function save({ title }: { readonly title: string }) {
		return Effect.gen(function* () {
			if (title === "blocked") {
				return yield* Effect.fail(new TitleRejected({ field: "title", message: "Choose another title" }));
			}
			const pending = yield* Deferred.make<void>();
			saves.set(title, pending);
			yield* Deferred.await(pending);
			restored.push(title);
			return title;
		});
	}
	function removeRow({ title }: { readonly title: string }) {
		return Effect.gen(function* () {
			if (title === "blocked") {
				return yield* Effect.fail(new Rejected());
			}
			const pending = yield* Deferred.make<void>();
			removals.set(title, pending);
			yield* Deferred.await(pending);
			const expectedVersion = (versions.get(title) ?? 7) + 1;
			versions.set(title, expectedVersion);
			return { expectedVersion, title };
		});
	}
	function restoreRow(input: typeof Removed.Type) {
		return Effect.gen(function* () {
			calls.push(input);
			const pending = yield* Deferred.make<void>();
			restores.set(input.title, pending);
			yield* Deferred.await(pending);
			const current = versions.get(input.title) ?? 7;
			if (current !== input.expectedVersion) {
				return yield* Effect.fail(new Conflict({ current, expected: input.expectedVersion }));
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
		);
	}
	const handlers = Api.toLayer(
		Effect.succeed(
			Api.of({
				"notices.$changes": () => Stream.never,
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
	class Client extends AtomRpc.Service<Client>()("test/NoticeClient", {
		group: Api,
		makeEffect: RpcTest.makeClient(Api, { flatten: true }),
		protocol: handlers,
	}) {}
	function gate(kind: "remove" | "restore" | "save", title: string) {
		const pending = { remove: removals, restore: restores, save: saves }[kind].get(title);
		if (!pending) {
			throw new Error(`${kind} ${title} has not started`);
		}
		return pending;
	}
	return { api: bind(Api, Client), calls, gate, reads, released, removals, runtime: Client.runtime, saves };
}
export type NoticeClient = ReturnType<typeof noticeClient>;
