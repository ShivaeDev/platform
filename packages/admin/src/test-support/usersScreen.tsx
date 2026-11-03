import { Effect, Option } from "effect";
import { act } from "react";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { type ClientActivity, clientActivity, isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { render } from "@shivaedev/test-story/client/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { UsersView } from "#client/adapters/UsersView.ts";
import { Access } from "./Access.ts";
import { postgresConfigured, postgresLayer } from "./jobsEngine.ts";
import { Page, usersEngine } from "./usersEngine.ts";
import { availability, rowOf, screenOf, usersReadouts } from "./usersScreenReadouts.ts";

type Engine = Effect.Success<typeof usersEngine> & {
	actor: string;
	activity: Option.Option<ClientActivity>;
	container: Option.Option<HTMLElement>;
};

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

function driverFor(engine: Engine, tell: (line: string) => void) {
	return screenDriver({
		act: async (action) => {
			await act(action);
		},
		pending: () =>
			!isClientIdle(Effect.runSync(Option.getOrThrow(engine.activity).current)) || screenOf(engine).querySelector('[role="status"]') !== null,
		root: () => screenOf(engine),
		tell,
	});
}

export const usersScreen = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () =>
		Effect.map(usersEngine, (engine) => ({
			...engine,
			activity: Option.none<ClientActivity>(),
			actor: "alice",
			container: Option.none<HTMLElement>(),
		})),
	layer: postgresLayer,
	name: "admin users screen",
	runIf: postgresConfigured,
	stages: ["users", "caller", "screen", "page"],
	verbs: (engine, story) => {
		const driver = driverFor(engine, story.tell);
		return {
			alert: () => Effect.sync(() => screenOf(engine).querySelector('[role="alert"]')?.textContent ?? "no alert"),
			assignFromAnotherClient: (actor: string, userId: string, role: typeof Access.Role.Type) => {
				story.tell(`${actor} assigns ${role} to ${userId} from another client`);
				return engine.clientAs(actor).pipe(Effect.flatMap((client) => client["admin.users.changeRole"]({ role, userId })));
			},
			chooseRole: (name: string, role: string) => Effect.andThen(driver.within(rowOf(engine, name)).select("select", role), driver.settle()),
			nextUsers: () => Effect.andThen(driver.click({ name: "Next users", role: "button" }), driver.settle()),
			nextUsersButton: () =>
				Effect.sync(() => {
					const button = [...screenOf(engine).querySelectorAll("button")].find(({ textContent }) => textContent === "Next users");
					return availability(button, "missing");
				}),
			previousUsers: () => Effect.andThen(driver.click({ name: "Previous users", role: "button" }), driver.settle()),
			refreshUsers: () => Effect.andThen(driver.click({ name: "Refresh users", role: "button" }), driver.settle()),
			...usersReadouts(engine, driver),
		};
	},
});

export const cannotAssignRoles = usersScreen.trait("caller", "carol reads users without permission to assign roles", (engine) => {
	engine.actor = "carol";
});

export const bobCanAssignRoles = usersScreen.trait("users", "alice has made bob a delegate who can assign roles", function* (engine) {
	const client = yield* engine.clientAs("alice");
	yield* client["admin.users.changeRole"]({ role: "delegate", userId: "bob" });
});

export const twentyOneUsers = usersScreen.trait(
	"users",
	"eighteen more registered users fill a twenty-user page and start another",
	function* (engine) {
		for (let index = 1; index <= 18; index += 1) {
			yield* engine.register(`d${String(index).padStart(2, "0")}`, "user");
		}
	},
);

export const viewOpen = usersScreen.trait("screen", "the users view is open without live subscriptions on its first page", function* (engine) {
	const protocol = yield* engine.protocolAs(engine.actor);
	const client = makeClient(Page.contract, { live: false, protocol, url: "http://localhost/rpc" });
	engine.activity = Option.some(clientActivity(client));
	const view = yield* Effect.acquireRelease(
		Effect.promise(() =>
			render(
				<UsersView changeRole={client.Client.runtime.fn(client.api.changeRole.run)} list={client.api.list.query} roles={Access.Role.literals} />,
			),
		),
		(screen) => Effect.promise(screen.unmount),
	);
	engine.container = Option.some(view.container);
	yield* driverFor(engine, () => undefined).settle();
});

export const onLastPage = usersScreen.trait("page", "the view has moved to the last page", (engine) => {
	const driver = driverFor(engine, () => undefined);
	return Effect.andThen(driver.click({ name: "Next users", role: "button" }), driver.settle());
});
