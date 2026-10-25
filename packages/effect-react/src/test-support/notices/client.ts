import { Deferred, Effect, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";

class Conflict extends Schema.TaggedError<Conflict>()("Conflict", { current: Schema.Number, expected: Schema.Number }) {}
class Rejected extends Schema.TaggedError<Rejected>()("Rejected", {}) {}
const rows = collection("notice-rows", Schema.String);
const Removed = Schema.Struct({ expectedVersion: Schema.Number, title: Schema.String });
const Remove = command("remove", {
	invalidates: () => [rows.list],
	payload: { title: Schema.String },
	rejections: { Rejected },
	success: Removed,
});
const Restore = command("restore", {
	invalidates: () => [rows.list],
	payload: Removed.fields,
	rejections: { Conflict },
	success: Schema.String,
});
const Edit = command("edit", { invalidates: () => [rows.list], payload: { title: Schema.String } });
const List = query("list", { reads: () => [rows.list], rejections: { Rejected }, success: Schema.String });
const BreakReads = command("breakReads", { invalidates: () => [rows.list] });
const Api = contract("notices", { commands: [Remove, Restore, Edit, BreakReads], queries: [List] });
export function noticeClient() {
	const removals = new Map<string, Deferred.Deferred<void>>();
	const restores = new Map<string, Deferred.Deferred<void>>();
	const versions = new Map<string, number>();
	const restored: string[] = ["existing"];
	let failReads = false;
	const calls: { title: string; expectedVersion: number }[] = [];
	const released: string[] = [];
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
				"notices.list": () => Effect.suspend(() => (failReads ? Effect.fail(new Rejected()) : Effect.succeed(restored.join(", ")))),
				"notices.remove": removeRow,
				"notices.restore": restoreRow,
			}),
		),
	);
	class Client extends AtomRpc.Service<Client>()("test/NoticeClient", {
		group: Api,
		makeEffect: RpcTest.makeClient(Api, { flatten: true }),
		protocol: handlers,
	}) {}
	function gate(kind: "remove" | "restore", title: string) {
		const pending = (kind === "remove" ? removals : restores).get(title);
		if (!pending) {
			throw new Error(`${kind} ${title} has not started`);
		}
		return pending;
	}
	return { api: bind(Api, Client), calls, gate, released, removals, runtime: Client.runtime };
}
export type NoticeClient = ReturnType<typeof noticeClient>;
