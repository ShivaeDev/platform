import { RegistryContext } from "@effect/atom-react";
import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { activityScreenSignal, type ClientActivity, clientActivity, isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { clientApp } from "@shivaedev/react/client/app.ts";
import { sessionRouter } from "@shivaedev/react/client/sessionRouter.ts";
import { RouterProvider } from "@shivaedev/react/RouterProvider.ts";
import { memberScreens } from "@shivaedev/test-story/server/adapters/memberScreens.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { accountModule } from "#client/accountModule.tsx";
import { makeAuth } from "#client/adapters/auth.ts";
import { routing } from "#client/routing.tsx";
import { notesModule } from "#modules/notes/client/module.tsx";

export function notesMemberScreens(baseUrl: string) {
	const pending = new Map<string, ClientActivity>();
	return memberScreens({
		baseUrl,
		mount: Effect.fnUntraced(function* (member) {
			const app = clientApp([accountModule, notesModule], {
				headers: { cookie: member.cookie, origin: new URL(baseUrl).origin },
				url: `${baseUrl}/rpc`,
				webSocketConstructor: layerWebSocketConstructor,
			});
			const auth = makeAuth({ baseUrl, fetchOptions: { customFetchImpl: member.fetch } });
			const connection = app.connect({ id: member.name }, member.registry);
			const router = sessionRouter({
				...routing,
				auth: auth.actions,
				connection,
				history: createMemoryHistory({ initialEntries: ["/"] }),
				registry: member.registry,
				session: () => ({ user: { id: member.name } }),
			});
			pending.set(member.name, clientActivity(connection));
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					pending.delete(member.name);
				}),
			);
			const root = yield* Effect.acquireRelease(
				Effect.sync(() => createRoot(member.root)),
				(rendered) =>
					Effect.promise(async () => {
						await act(() => rendered.unmount());
					}),
			);
			yield* Effect.promise(async () => {
				await act(() => {
					root.render(
						<RegistryContext.Provider value={member.registry}>
							<RouterProvider router={router} />
						</RegistryContext.Provider>,
					);
				});
			});
		}),
		verbs: (member, tell) => {
			const activity = pending.get(member.name);
			if (activity === undefined) {
				throw new Error(`No client for ${member.name}`);
			}
			const driver = screenDriver({ act, activity: activityScreenSignal(activity), root: member.root, tell });
			const idle = screenDriver({ act, activity: activityScreenSignal(activity, isClientIdle), root: member.root, tell });
			return {
				addsNote: (title: string) =>
					Effect.gen(function* () {
						yield* driver.enter({ name: "New note", role: "textbox" }, title);
						yield* driver.click({ name: "Add note", role: "button" });
						yield* driver.find({ name: title, role: "link" });
					}),
				refreshes: () => Effect.andThen(driver.click({ name: "Refresh", role: "button" }), idle.settle()),
				savedNotes: () =>
					Effect.andThen(
						driver.find({ name: "New note", role: "textbox" }),
						Effect.sync(() => {
							const titles = [...member.root.querySelectorAll('table[aria-label="Saved notes"] tbody a')].map((link) => link.textContent);
							return titles.length === 0 && member.root.textContent.includes("No notes yet") ? ["no notes yet"] : titles;
						}),
					),
			};
		},
	});
}
