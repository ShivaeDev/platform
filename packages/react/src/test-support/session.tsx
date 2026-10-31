import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { Editor } from "#test/order-example/Editor.tsx";
import { makeClient } from "#test/order-example/makeClient.ts";
import { clickButton, typeInput } from "./Screen.ts";
import { RegistryProbe } from "./sessionProbes.ts";

interface Session {
	readonly id: string;
	readonly token: string;
}
export function shell(url: string, view: Rendered) {
	window.location.href = url;
	const { container } = view;
	const registries: AtomRegistry.AtomRegistry[] = [];
	const rechecks: string[] = [];
	function show(session: Session | undefined, id: number) {
		return view.render(
			<SessionBoundary
				connect={(current) => makeClient({ token: current.token, url })}
				identify={(current) => current.id}
				recheck={() => rechecks.push(session?.id ?? "none")}
				session={session}
				signedOut={<p>Signed out</p>}
			>
				{(client) => (
					<>
						<RegistryProbe registries={registries} />
						<Editor client={client} id={id} />
					</>
				)}
			</SessionBoundary>,
		);
	}
	function input() {
		return container.querySelector<HTMLInputElement>('input[name="name"]');
	}
	return {
		close: view.unmount,
		container,
		edit: (value: string) => act(() => typeInput(container, "name", value)),
		input,
		rechecks,
		refresh: () => act(async () => clickButton(container, "Refresh")),
		registries,
		show,
	};
}
export function sessions() {
	return new Map([
		["alice-token", { user: { id: "alice" } }],
		["bob-token", { user: { id: "bob" } }],
	]);
}
