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
		Effect.map((root) => ({
			...root,
			client,
			driver: screenDriver({
				act: async (action) => {
					await act(action);
				},
				pending: () => root.registry.get(client.query).waiting || root.container.querySelector("button")?.disabled !== false,
				root: root.container,
				tell,
			}),
		})),
	);
}
