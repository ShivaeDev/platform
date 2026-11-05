import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { DateTime, Effect } from "effect";
import { act } from "react";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AppAccess } from "#AppAccess.ts";
import { makeFoundationClient } from "#client/admin/foundation.ts";
import { notesHttp } from "#modules/notes/test-support/http.ts";
import { startHost } from "#test-support/host.ts";
import { configured, postgres } from "#test-support/postgres.ts";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";
import { openScreen } from "./openScreen.tsx";

type Account = Effect.Success<ReturnType<typeof mintUser>>;
export interface AdminScreen extends ScreenSurface {
	readonly accounts: Map<string, Account>;
	readonly host: Effect.Success<ReturnType<typeof startHost>>;
}

export const adminScreens = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create(): Generator<ReturnType<typeof startHost>, AdminScreen, never> {
		return { accounts: new Map(), host: yield* startHost(), view: undefined };
	},
	inspect: (engine) => ({ accounts: [...engine.accounts.keys()], baseUrl: engine.host.baseUrl, text: engine.view?.container.textContent }),
	layer: postgres,
	name: "admin screen",
	runIf: configured,
	stages: ["accounts", "notes", "screen"],
	verbs: (engine, story) => {
		const ui = uiScreenVerbs(engine, story.tell);
		const controls = screenDriver({ act, root: () => screenView(engine).container, tell: story.tell });
		function container() {
			return screenView(engine).container;
		}
		function userRow(name: string) {
			const found = [...container().querySelectorAll("tbody tr")].find((row) =>
				row.querySelectorAll("td")[1]?.textContent.includes(`${name}@app.test`),
			);
			if (found === undefined) {
				throw new Error(`No Users row for ${name}`);
			}
			return found;
		}
		return {
			alert: () => Effect.sync(() => container().querySelector('[role="alert"]')?.textContent ?? "no alert"),
			assignsRole: Effect.fn("AdminScreen.assignsRole")(function* (actor: string, target: string, role: typeof AppAccess.Role.Type) {
				story.tell(`${actor} assigns ${target} the ${role} role from another client`);
				const client = makeFoundationClient(`${engine.host.baseUrl}/rpc`, {
					headers: { cookie: engine.accounts.get(actor)?.headers.get("cookie") ?? "", origin: engine.host.origin },
					webSocketConstructor: layerWebSocketConstructor,
				});
				yield* (yield* client.client)["admin.users.changeRole"]({ role, userId: engine.accounts.get(target)?.user.id ?? "missing" });
			}),
			choosesRole: (name: string, role: string) =>
				Effect.andThen(controls.select({ name: `Role for ${name}@app.test`, role: "combobox" }, role), ui.settle()),
			heading: ui.heading,
			noteStatistics: () =>
				Effect.sync(() =>
					Object.fromEntries([...container().querySelectorAll("dl dt")].map((term) => [term.textContent, term.nextElementSibling?.textContent])),
				),
			opensNoteStatistics: () => Effect.andThen(ui.clickControl({ name: "Note statistics", role: "link" }), ui.settle()),
			queueFilter: () => Effect.sync(() => controls.selection({ name: "Queue", role: "combobox" }).options.map(({ value }) => value)),
			refreshesUsers: () => Effect.andThen(ui.clickControl({ name: "Refresh users", role: "button" }), ui.settle()),
			roleControl: (name: string) => Effect.sync(() => (userRow(name).querySelector("select") === null ? "not offered" : "offered")),
			settle: ui.settle,
			shown: ui.shown,
			shownRole: (name: string) =>
				Effect.sync(() => userRow(name).querySelector("select")?.value ?? userRow(name).querySelectorAll("td")[2]?.querySelector("div")?.textContent),
			shownUsers: () =>
				Effect.sync(() =>
					[...container().querySelectorAll("tbody tr")]
						.map((row) => row.querySelectorAll("td")[1]?.querySelector("div")?.textContent ?? "no email")
						.sort((left, right) => left.localeCompare(right)),
				),
		};
	},
});

export function adminScreen(path = "/admin/jobs", role: typeof AppAccess.Role.Type = "admin") {
	return adminScreens.trait("screen", `alice, signed in as ${role}, opens ${path} on the real app host`, function* (engine) {
		yield* openScreen(engine, path, role);
	});
}

export function adminScreenAccount(name: string, role: typeof AppAccess.Role.Type = "user") {
	return adminScreens.trait("accounts", `${name} has a signed-in ${role} account`, function* (engine) {
		engine.accounts.set(name, yield* mintUser(engine.host, name, role));
	});
}

export const pendingNote = adminScreens.trait("notes", "bob creates a note whose word count is pending", function* (engine) {
	const bob = yield* mintUser(engine.host, "bob");
	const client = yield* notesHttp(engine.host.baseUrl, bob.headers.get("cookie") ?? "", engine.host.origin);
	yield* client["notes.create"]({ title: "A note awaiting word count" });
});
