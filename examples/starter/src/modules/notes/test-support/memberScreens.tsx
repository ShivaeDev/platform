import { RegistryContext } from "@effect/atom-react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { memberScreens } from "@shivaedev/test-story/server/memberScreens.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { appRouter } from "#client/appRouter.tsx";
import { makeAuth } from "#client/auth.ts";
import { connectModules } from "#client/Module.ts";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";

export function notesMemberScreens(baseUrl: string) {
	const pending = new Map<string, () => boolean>();
	return memberScreens({
		baseUrl,
		mount: Effect.fnUntraced(function* (member) {
			const protocol = RpcClient.layerProtocolHttp({ url: `${baseUrl}/rpc` }).pipe(
				Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
				Layer.provide(Layer.succeed(FetchHttpClient.Fetch, member.fetch)),
			);
			const client = makeNotesClient(`${baseUrl}/rpc`, { live: false, protocol });
			const auth = makeAuth({ baseUrl, fetchOptions: { customFetchImpl: member.fetch } });
			const router = appRouter(
				member.registry,
				connectModules([notesRegistration(client)]),
				auth.actions,
				createMemoryHistory({ initialEntries: ["/"] }),
			);
			pending.set(
				member.name,
				() => router.state.isLoading || member.registry.get(client.api.list.query()).waiting || member.root.querySelector("button:disabled") !== null,
			);
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
		verbs: (member, tell) => screenDriver({ act, pending: () => pending.get(member.name)?.() ?? false, root: member.root, tell }),
	});
}
