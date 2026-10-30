import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { Screen } from "#test/Screen.ts";
import { Editor } from "./Editor.tsx";
import { makeClient } from "./makeClient.ts";

export function openScreen(screen: Screen, url: string, token: string, entityId: number, tell: (line: string) => void) {
	const client = makeClient(url, token, entityId);
	return screen.open(<Editor client={client} />).pipe(
		// Each rendered root owns its registry, so writer invalidation cannot refresh another root.
		Effect.map((root) => {
			// A hint then invalidates at once instead of after a bare timer that no story can wait on.
			root.registry.set(client.coalesceWindow, 0);
			return {
				...root,
				client,
				driver: screenDriver({
					act: async (action) => {
						await act(action);
					},
					pending: () =>
						root.registry.get(client.status).connection !== "live"
						|| root.registry.get(client.query).waiting
						|| root.container.querySelector("button")?.disabled !== false,
					root: root.container,
					tell,
				}),
				entityId,
				nextHint: () =>
					new Promise<void>((resolve) => {
						const stop = root.registry.subscribe(client.status, () => {
							stop();
							resolve();
						});
					}),
			};
		}),
	);
}
