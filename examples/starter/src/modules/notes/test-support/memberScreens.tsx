import { RegistryContext } from "@effect/atom-react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { type ClientActivity, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { memberScreens } from "@shivaedev/test-story/server/memberScreens.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { appRouter } from "#client/appRouter.tsx";
import { makeAuth } from "#client/auth.ts";
import { connectModules } from "#client/Module.ts";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";

export function notesMemberScreens(baseUrl: string) {
	const pending = new Map<string, ClientActivity>();
	return memberScreens({
		baseUrl,
		mount: Effect.fnUntraced(function* (member) {
			const protocol = RpcClient.layerProtocolHttp({ url: `${baseUrl}/rpc` }).pipe(
				Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
				Layer.provide(Layer.succeed(FetchHttpClient.Fetch, member.fetch)),
			);
			const client = makeNotesClient(`${baseUrl}/rpc`, { live: false, protocol });
			const auth = makeAuth({ baseUrl, fetchOptions: { customFetchImpl: member.fetch } });
			const router = yield* appRouter(
				connectModules([notesRegistration(client)]),
				auth.actions,
				createMemoryHistory({ initialEntries: ["/"] }),
				() => ({ user: { id: member.name } }),
			).pipe(Effect.provideService(AtomRegistry.AtomRegistry, member.registry));
			pending.set(member.name, clientActivity(client));
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
			const driver = screenDriver({ act, pending: activity, root: member.root, tell });
			return {
				addsNote: (title: string) =>
					Effect.gen(function* () {
						yield* driver.enter({ name: "New note", role: "textbox" }, title);
						yield* driver.click({ name: "Add note", role: "button" });
						yield* driver.find({ name: title, role: "link" });
					}),
				refreshes: () => Effect.andThen(driver.click({ name: "Refresh", role: "button" }), driver.settle()),
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
