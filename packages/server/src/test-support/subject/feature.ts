import { Context, Effect, Layer, Option, Schema, Stream } from "effect";
import type { Headers } from "effect/http";
import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query, stream } from "@shivaedev/contract/operation.ts";
import { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { accountSubject, Subject, selfSubject } from "@shivaedev/identity/subject.ts";
import { appHost } from "#appHost.ts";

export class CannotActForAccount extends Schema.TaggedError<CannotActForAccount>()("CannotActForAccount", { account: Schema.String }) {}
const Edit = permission("accounts.edit");
const Roles = roleSet(role("member", [Edit]), role("manager", [Edit.any]), role("visitor", []));
const rename = command("rename", {
	invalidates: () => [],
	payload: { title: Schema.String },
	success: Schema.Struct({ actor: Schema.String, name: Schema.String, subject: Schema.String, title: Schema.String }),
});
const read = query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String });
const Own = contract("own", { commands: [rename], queries: [read], subject: selfSubject });
const delegated = accountSubject({ deny: (account) => new CannotActForAccount({ account }), permission: Edit, refusal: CannotActForAccount });
const Delegated = contract("delegated", {
	commands: [rename],
	queries: [read],
	streams: [stream("follow", { reads: () => [], success: Schema.String })],
	subject: delegated,
});
const Shared = contract("own", {
	commands: [command("renameFor", { invalidates: rename.invalidates, payload: rename.payload, success: rename.success })],
	subject: delegated,
});
export const Api = Own.merge(Delegated, Shared.application);

export interface State {
	readonly handled: string[];
	readonly revoked: Set<string>;
	sessions: boolean;
	readonly titles: Map<string, string>;
}

class Titles extends Context.Service<
	Titles,
	{ readonly rename: (title: string) => Effect.Effect<typeof rename.success.Type, never, Subject | SessionUser | Identity> }
>()("@shivaedev/server/test/subject/Titles") {}

export function subjectHost(state: State) {
	const services = Layer.succeed(Titles, {
		rename: Effect.fnUntraced(function* (title) {
			const { id } = yield* Subject;
			const actor = yield* Identity;
			const user = yield* SessionUser;
			state.handled.push(`${actor.id} renamed ${id}`);
			state.titles.set(id, title);
			return { actor: actor.id, name: user.name, subject: id, title };
		}),
	});
	function save({ title }: { readonly title: string }) {
		return Effect.flatMap(Titles, (titles) => titles.rename(title));
	}
	const options = {
		config: { port: 0 },
		group: Api,
		handlers: Layer.mergeAll(
			Own.application.toLayer({ "own.read": () => Effect.map(Subject, ({ id }) => id), "own.rename": save }),
			Shared.application.toLayer({ "own.renameFor": save }),
			Delegated.application.toLayer({
				"delegated.follow": () => Stream.concat(Stream.fromEffect(Effect.map(Subject, ({ id }) => id)), Stream.never),
				"delegated.read": () => Effect.map(Subject, ({ id }) => id),
				"delegated.rename": save,
			}),
		),
		services,
	};
	return state.sessions
		? appHost({ ...options, sessions: Layer.succeed(SessionPolicy, sessions(state)) })
		: appHost({ ...options, policy: "loopback" });
}

function sessions(state: State) {
	function get(headers: Headers.Headers) {
		const id = headers.authorization;
		if (id === undefined || id === "") {
			return Effect.succeed(Option.none());
		}
		let sessionRole = "member";
		if (id === "manager") {
			sessionRole = "manager";
		}
		if (id === "visitor" || state.revoked.has(id)) {
			sessionRole = "visitor";
		}
		return Effect.succeed(Option.some({ user: { email: `${id}@example.test`, id, name: id, role: sessionRole } }));
	}
	return { origin: () => true, provider: { get }, roles: Roles };
}
