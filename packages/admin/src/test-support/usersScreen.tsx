import { DateTime, Effect, Layer, Option, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { act } from "react";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { Forbidden } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { render } from "@shivaedev/effect-react/client/testing.ts";
import { Identity, SessionUser } from "@shivaedev/platform/rpc/identity.ts";
import { type ChangeRoleInput, LastOwner } from "@shivaedev/platform/rpc/userRoles.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { UsersView } from "#client/UsersView.ts";
import { AdminPermission } from "#permissions.ts";
import { UsersPage } from "#users/page.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

const authenticated = Layer.succeed(AdminPermission, (effect) =>
	effect.pipe(
		Effect.provideService(Identity, { id: "owner" }),
		Effect.provideService(SessionUser, { email: "owner@app.test", id: "owner", name: "Owner", role: "admin,owner" }),
	),
);

export const usersScreen = storyKit({
	clock: "live",
	create: () => ({ owner: true, rejection: "" }),
	name: "admin users screen",
	stages: ["caller"],
	verbs: (engine, story) => {
		const requests: (typeof ChangeRoleInput.Type)[] = [];
		const user = { createdAt: DateTime.makeUnsafe("2026-10-20T12:34:56Z"), email: "alice@app.test", id: "alice", name: "Alice", roles: ["user"] };
		function change(input: typeof ChangeRoleInput.Type): Effect.Effect<void, Forbidden | LastOwner> {
			return Effect.suspend((): Effect.Effect<void, Forbidden | LastOwner> => {
				requests.push(input);
				if (engine.rejection === "last") {
					return Effect.fail(new LastOwner({ userId: input.userId }));
				}
				if (engine.rejection === "forbidden") {
					return Effect.fail(new Forbidden({ message: "Owner role required" }));
				}
				user.roles = input.grant ? [...user.roles, input.role] : user.roles.filter((role) => role !== input.role);
				return Effect.void;
			});
		}
		const handlers = UsersPage.contract.toLayer({
			"admin.users.$changes": () => Stream.never,
			"admin.users.changeRole": change,
			"admin.users.list": ({ cursor }) =>
				Effect.succeed({
					canChangeRoles: engine.owner,
					next: cursor === undefined ? Option.some("alice") : Option.none<string>(),
					users: cursor === undefined ? [{ ...user }] : [{ ...user, email: "bob@app.test", id: "bob", name: "Bob" }],
				}),
		});
		class Client extends AtomRpc.Service<Client>()("test/UsersScreen", {
			group: UsersPage.contract,
			makeEffect: RpcTest.makeClient(UsersPage.contract, { flatten: true }),
			protocol: handlers.pipe(Layer.provideMerge(authenticated)),
		}) {}
		const api = bind(UsersPage.contract, Client);
		const changeRole = Client.runtime.fn(api.changeRole.run);
		let container: HTMLElement | undefined;
		return {
			click: (selector: string) =>
				Effect.promise(async () => {
					story.tell(`click ${selector}`);
					const control = container?.querySelector<HTMLElement>(selector);
					if (control === undefined || control === null) {
						throw new Error(`Missing control ${selector}`);
					}
					await act(async () => control.click());
				}),
			content: () => {
				if (container === undefined) {
					throw new Error("Users screen is not open");
				}
				return container;
			},
			open: () =>
				Effect.gen(function* () {
					story.tell("open the package users view");
					const view = yield* Effect.acquireRelease(
						Effect.promise(() => render(<UsersView changeRole={changeRole} list={api.list.query} />)),
						(screen) => Effect.promise(screen.unmount),
					);
					container = view.container;
				}),
			requests: () => requests,
		};
	},
});

export const readOnlyAdmin = usersScreen.trait("caller", "the admin is not an owner", (engine) => {
	engine.owner = false;
});
export function rejectedRoleChange(reason: "last" | "forbidden") {
	return usersScreen.trait("caller", `the server rejects the change as ${reason}`, (engine) => {
		engine.rejection = reason;
	});
}
