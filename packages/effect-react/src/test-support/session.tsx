import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { SessionBoundary } from "#session-boundary.ts";
import { makeOrderEditor } from "#test/order-example/frontend.tsx";
import type { Rendered } from "#testing.ts";
import { clickButton, typeInput } from "./screenKit.ts";
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
				connect={(current) => makeOrderEditor({ token: current.token, url })}
				identify={(current) => current.id}
				recheck={() => rechecks.push(session?.id ?? "none")}
				session={session}
				signedOut={<p>Signed out</p>}
			>
				{({ Editor }) => (
					<>
						<RegistryProbe registries={registries} />
						<Editor id={id} />
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
		["alice-token", { expiresAt: Number.POSITIVE_INFINITY, userId: "alice" }],
		["bob-token", { expiresAt: Number.POSITIVE_INFINITY, userId: "bob" }],
	]);
}
