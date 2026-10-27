import { Effect, Exit, Option, Request, RequestResolver, Schema } from "effect";
import { collection, type Key } from "#keys.ts";
import type { ModuleReadPolicies } from "#readPolicy.ts";

export interface Viewer {
	readonly id: string;
}
interface Membership extends Request.Request<boolean> {
	readonly _tag: "Membership";
	readonly key: Key;
	readonly space: string;
	readonly viewer: string;
}
const Membership = Request.tagged<Membership>("Membership");
export const documents = collection("documents", Schema.String);
export const tasks = collection("tasks", Schema.String);
export const mySpaces = collection("my-spaces", Schema.String);

export function modulePolicies() {
	const batches: (readonly Membership[])[] = [];
	const viewers: Option.Option<Viewer>[] = [];
	const members = new Map([
		["one", new Set(["alice"])],
		["two", new Set(["bob"])],
	]);
	const resolver = RequestResolver.makeGrouped<Membership, string>({
		key: ({ request }) => JSON.stringify([request.space, request.viewer]),
		resolver: (entries) =>
			Effect.sync(() => {
				batches.push(entries.map(({ request }) => request));
				const { space, viewer } = entries[0].request;
				const allowed = members.get(space)?.has(viewer) ?? false;
				for (const entry of entries) {
					entry.completeUnsafe(Exit.succeed(allowed));
				}
			}),
	});
	const documentPolicies = {
		[documents.name]: (key, viewer) =>
			Effect.gen(function* () {
				viewers.push(viewer);
				if (Option.isNone(viewer) || key._tag === "List") {
					return false;
				}
				return yield* Effect.request(Membership({ key, space: String(key.id).split("/")[0] ?? "", viewer: viewer.value.id }), resolver);
			}),
		[mySpaces.name]: (key, viewer) => Effect.succeed(key._tag === "Item" && Option.isSome(viewer) && key.id === viewer.value.id),
	} satisfies ModuleReadPolicies<Viewer>;
	const taskPolicies = {
		[tasks.name]: (key, viewer) => Effect.succeed(Option.isSome(viewer) && key._tag === "Item" && key.id === viewer.value.id),
	} satisfies ModuleReadPolicies<Viewer>;
	return { batches, documentPolicies, taskPolicies, viewers };
}
