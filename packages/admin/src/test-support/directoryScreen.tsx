import { Clock, Effect, Option } from "effect";
import { act } from "react";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { clientActivity, isClientSettled } from "@shivaedev/contract/clientActivity.ts";
import type { AuthTableOptions } from "@shivaedev/identity/server/better-auth/adapters/tables.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenAct } from "@shivaedev/test-story/server/adapters/screenAct.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { UsersView } from "#client/adapters/UsersView.ts";
import { Access } from "./Access.ts";
import { clientRuntime } from "./clientRuntime.ts";
import { postgresConfigured, postgresLayer } from "./jobsEngine.ts";
import { mappedTables } from "./mappedTables.ts";
import { makeUsersEngine, Page } from "./usersEngine.ts";

const openDirectory = Effect.fnUntraced(function* (mapping: AuthTableOptions) {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	const engine = yield* makeUsersEngine(mapping);
	const protocol = yield* engine.protocolAs("alice");
	const clock = yield* Clock.Clock;
	const runtime = yield* clientRuntime;
	const client = makeClient(Page.contract, { protocol, runtime, url: "http://localhost/rpc" });
	const activity = clientActivity(client);
	const view = yield* Effect.acquireRelease(
		Effect.promise(() =>
			render(
				<UsersView changeRole={client.Client.runtime.fn(client.api.changeRole.run)} list={client.api.list.query} roles={Access.Role.literals} />,
			),
		),
		(screen) => Effect.promise(screen.unmount),
	);
	const driver = screenDriver({
		act,
		pending: () => !isClientSettled(Effect.runSync(activity.current)) || view.container.querySelector('[role="status"]') !== null,
		root: view.container,
		tell: () => undefined,
	});
	yield* driver.settle();
	yield* screenAct(act, until(activity, ({ liveHints }) => liveHints > 0, { name: "users live subscription" }).pipe(Effect.asVoid));
	return { activity, clock, driver, engine, view };
});

function directoryKit(mapping: AuthTableOptions) {
	return storyKit({
		around: withIsolatedDatabase,
		clock: "test",
		create: () => openDirectory(mapping),
		layer: postgresLayer,
		name: "users directory screen",
		runIf: postgresConfigured,
		stages: [],
		verbs: ({ activity, clock, driver, engine, view }, story) => ({
			assignFromAnotherClient: (userId: string, role: typeof Access.Role.Type) =>
				Effect.gen(function* () {
					story.tell(`alice assigns ${role} to ${userId} from another client`);
					const before = yield* activity.current;
					const client = yield* engine.clientAs("alice");
					yield* screenAct(
						act,
						client["admin.users.changeRole"]({ role, userId }).pipe(
							Effect.andThen(until(activity, ({ liveHints }) => liveHints > before.liveHints, { name: "users role change hint" })),
							Effect.andThen(untilTimer("20 millis")),
							Effect.andThen(passes("20 millis", Effect.void)),
							Effect.provideService(Clock.Clock, clock),
						),
					);
					yield* driver.settle();
				}),
			shownRoles: () =>
				Effect.sync(() =>
					Object.fromEntries(
						[...view.container.querySelectorAll<HTMLSelectElement>("select")].map((select) => [
							Option.getOrThrow(Option.fromNullishOr(select.getAttribute("aria-label"))),
							select.value,
						]),
					),
				),
		}),
	});
}

export const directoryScreen = directoryKit({});
export const mappedDirectoryScreen = directoryKit(mappedTables);
