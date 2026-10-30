import { DateTime, Effect, Layer, Option, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { act } from "react";
import { bind } from "@shivaedev/contract/bind.ts";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import { render } from "@shivaedev/react/client/testing.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
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

type Refusal = "last role assigner" | "forbidden";

function usersScreenEngine() {
	const requests: ChangeRoleInput[] = [];
	return {
		canChangeRoles: true,
		container: Option.none<HTMLElement>(),
		inFlight: 0,
		refusal: Option.none<Refusal>(),
		requests,
		users: [
			{ createdAt: DateTime.makeUnsafe("2026-10-20T12:34:56Z"), email: "alice@app.test", id: "alice", name: "Alice", role: "user" },
			{ createdAt: DateTime.makeUnsafe("2026-10-21T08:00:00Z"), email: "bob@app.test", id: "bob", name: "Bob", role: "user" },
		],
	};
}

type Engine = ReturnType<typeof usersScreenEngine>;

function counted<A, E>(engine: Engine, effect: Effect.Effect<A, E>) {
	return Effect.acquireUseRelease(
		Effect.sync(() => {
			engine.inFlight += 1;
		}),
		() => effect,
		() =>
			Effect.sync(() => {
				engine.inFlight -= 1;
			}),
	);
}

function serve(engine: Engine) {
	return UsersPage.contract.toLayer({
		"admin.users.$changes": () => Stream.never,
		"admin.users.changeRole": (input) =>
			counted(
				engine,
				Effect.suspend((): Effect.Effect<void, Forbidden | LastRoleAssigner> => {
					engine.requests.push(input);
					if (Option.contains(engine.refusal, "last role assigner")) {
						return Effect.fail(new LastRoleAssigner({ userId: input.userId }));
					}
					if (Option.contains(engine.refusal, "forbidden")) {
						return Effect.fail(new Forbidden({ message: "Permission required to assign roles" }));
					}
					engine.users = engine.users.map((user) => (user.id === input.userId ? { ...user, role: input.role } : user));
					return Effect.void;
				}),
			),
		// One user per page, so the view's paging controls have a second page to reach.
		"admin.users.list": ({ cursor }) =>
			counted(
				engine,
				Effect.sync(() => {
					const start = cursor === undefined ? 0 : engine.users.findIndex(({ id }) => id === cursor) + 1;
					const page = engine.users.slice(start, start + 1);
					const last = start + 1 >= engine.users.length;
					return { canChangeRoles: engine.canChangeRoles, next: last ? Option.none<string>() : Option.fromUndefinedOr(page[0]?.id), users: page };
				}),
			),
	});
}

function screenOf(engine: Engine) {
	return Option.getOrThrowWith(engine.container, () => new Error("The users view is not open"));
}

function rowOf(engine: Engine, name: string) {
	const row = [...screenOf(engine).querySelectorAll("tbody tr")].find((candidate) => candidate.querySelector("td")?.textContent === name);
	if (row === undefined) {
		throw new Error(`${name} is not shown`);
	}
	return row;
}

function availability(control: HTMLButtonElement | HTMLSelectElement | null | undefined, missing: string) {
	if (control === null || control === undefined) {
		return missing;
	}
	return control.disabled ? "disabled" : "enabled";
}

function pending(engine: Engine) {
	const screen = screenOf(engine);
	return engine.inFlight > 0 || screen.querySelector('[role="status"]') !== null || screen.querySelector("select:disabled") !== null;
}

function driverFor(engine: Engine, tell: (line: string) => void) {
	return screenDriver({
		act: async (action) => {
			await act(action);
		},
		pending: () => pending(engine),
		root: () => screenOf(engine),
		tell,
	});
}

export const usersScreen = storyKit({
	clock: "live",
	create: usersScreenEngine,
	inspect: ({ canChangeRoles, refusal, requests }) => ({ canChangeRoles, refusal, requests }),
	name: "admin users screen",
	stages: ["caller", "screen", "page"],
	verbs: (engine, story) => {
		const driver = driverFor(engine, story.tell);
		return {
			alert: () => Effect.sync(() => screenOf(engine).querySelector('[role="alert"]')?.textContent ?? "no alert"),
			chooseRole: (name: string, role: string) =>
				Effect.gen(function* () {
					story.tell(`choose ${role} for ${name}`);
					const select = rowOf(engine, name).querySelector("select");
					if (select === null) {
						throw new Error(`${name} has no role control`);
					}
					yield* Effect.sync(() =>
						act(() => {
							select.value = role;
							select.dispatchEvent(new Event("change", { bubbles: true }));
						}),
					);
					yield* driver.settle();
				}),
			nextUsers: () => Effect.andThen(driver.click({ name: "Next users", role: "button" }), driver.settle()),
			nextUsersButton: () =>
				Effect.sync(() => {
					const button = [...screenOf(engine).querySelectorAll("button")].find(({ textContent }) => textContent === "Next users");
					return availability(button, "missing");
				}),
			previousUsers: () => Effect.andThen(driver.click({ name: "Previous users", role: "button" }), driver.settle()),
			requests: () => Effect.sync(() => [...engine.requests]),
			roleChoices: (name: string) =>
				Effect.sync(() => {
					const select = rowOf(engine, name).querySelector("select");
					return select === null ? "no role control" : [...select.options].map(({ value }) => value);
				}),
			roleControl: (name: string) => Effect.sync(() => availability(rowOf(engine, name).querySelector("select"), "no role control")),
			shownUsers: () =>
				Effect.sync(() =>
					[...screenOf(engine).querySelectorAll("tbody tr")].map((row) => {
						const [name, email, role] = [...row.querySelectorAll("td")].map((cell) => cell.querySelector("select")?.value ?? cell.textContent);
						const time = row.querySelector("time");
						return { email, name, role, signedUp: time?.textContent, signedUpDateTime: time?.dateTime };
					}),
				),
		};
	},
});

export const cannotAssignRoles = usersScreen.trait("caller", "the caller cannot assign roles", (engine) => {
	engine.canChangeRoles = false;
});

export function serverRefusesRoleChanges(refusal: Refusal) {
	return usersScreen.trait("caller", `the server refuses every role change as ${refusal}`, (engine) => {
		engine.refusal = Option.some(refusal);
	});
}

export const viewOpen = usersScreen.trait("screen", "the users view is open on its first page", function* (engine) {
	const handlers = serve(engine);
	class Client extends AtomRpc.Service<Client>()("test/UsersScreen", {
		group: UsersPage.contract,
		makeEffect: RpcTest.makeClient(UsersPage.contract, { flatten: true }),
		protocol: handlers.pipe(Layer.provideMerge(authenticated)),
	}) {}
	const api = bind(UsersPage.contract, Client, { live: false });
	const changeRole = Client.runtime.fn(api.changeRole.run);
	const view = yield* Effect.acquireRelease(
		Effect.promise(() => render(<UsersView changeRole={changeRole} list={api.list.query} roles={Access.Role.literals} />)),
		(screen) => Effect.promise(screen.unmount),
	);
	engine.container = Option.some(view.container);
	yield* driverFor(engine, () => undefined).settle();
});

export const onBobsPage = usersScreen.trait("page", "the view has moved on to the next page, which shows bob", (engine) => {
	const driver = driverFor(engine, () => undefined);
	return Effect.andThen(driver.click({ name: "Next users", role: "button" }), driver.settle());
});
