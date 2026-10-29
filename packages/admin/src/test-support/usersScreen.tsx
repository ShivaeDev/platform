import { DateTime, Effect, Layer, Option, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { act } from "react";
import { bind } from "@shivaedev/contract/bind.ts";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import { render } from "@shivaedev/react/client/testing.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { UsersView } from "#client/UsersView.ts";
import { UsersPermission } from "#permissions.ts";
import { usersPage } from "#users/page.ts";
import { type ChangeRoleInput, LastRoleAssigner } from "#users/roles.ts";
import { Access } from "./Access.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

const UsersPage = usersPage(Access);
const authenticated = Layer.succeed(UsersPermission, (effect) =>
	effect.pipe(
		Effect.provideService(Identity, { id: "owner" }),
		Effect.provideService(SessionUser, { email: "owner@app.test", id: "owner", name: "Owner", role: "owner" }),
	),
);

export const usersScreen = storyKit({
	clock: "live",
	create: () => ({ owner: true, rejection: "" }),
	name: "admin users screen",
	stages: ["caller"],
	verbs: (engine, story) => {
		const requests: ChangeRoleInput[] = [];
		const user = { createdAt: DateTime.makeUnsafe("2026-10-20T12:34:56Z"), email: "alice@app.test", id: "alice", name: "Alice", role: "user" };
		function change(input: ChangeRoleInput): Effect.Effect<void, Forbidden | LastRoleAssigner> {
			return Effect.suspend((): Effect.Effect<void, Forbidden | LastRoleAssigner> => {
				requests.push(input);
				if (engine.rejection === "last") {
					return Effect.fail(new LastRoleAssigner({ userId: input.userId }));
				}
				if (engine.rejection === "forbidden") {
					return Effect.fail(new Forbidden({ message: "Permission required to assign roles" }));
				}
				user.role = input.role;
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
		const api = bind(UsersPage.contract, Client, { live: false });
		const changeRole = Client.runtime.fn(api.changeRole.run);
		let container: HTMLElement | undefined;
		return {
			chooseRole: (role: string) =>
				Effect.promise(async () => {
					story.tell(`assign ${role} to Alice`);
					const select = container?.querySelector("select");
					if (!select) {
						throw new Error("Missing role select");
					}
					await act(() => {
						select.value = role;
						select.dispatchEvent(new Event("change", { bubbles: true }));
					});
				}),
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
						Effect.promise(() => render(<UsersView changeRole={changeRole} list={api.list.query} roles={Access.Role.literals} />)),
						(screen) => Effect.promise(screen.unmount),
					);
					container = view.container;
				}),
			requests: () => requests,
		};
	},
});

export const readOnlyAdmin = usersScreen.trait("caller", "the caller cannot assign roles", (engine) => {
	engine.owner = false;
});
export function rejectedRoleChange(reason: "last" | "forbidden") {
	return usersScreen.trait("caller", `the server rejects the change as ${reason}`, (engine) => {
		engine.rejection = reason;
	});
}
