import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { querySignals } from "@shivaedev/contract/querySignals.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import type { Screen } from "#test/Screen.ts";
import { Editor } from "./Editor.tsx";
import { makeClient } from "./makeClient.ts";

export function openScreen(screen: Screen, url: string, token: string, entityId: number, tell: (line: string) => void) {
	const client = makeClient(url, token, entityId);
	return screen.open(<Editor client={client} />).pipe(
		Effect.map((root) => {
			const signals = querySignals(client.query);
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
				nextResult: () => {
					const before = root.registry.get(signals).completed;
					return until(AtomRegistry.toStream(root.registry, signals), ({ completed }) => completed > before, { name: "pushed settings" });
				},
			};
		}),
	);
}
