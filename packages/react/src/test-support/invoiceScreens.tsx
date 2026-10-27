import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { Rendered } from "#client/testing.ts";
import { InvoiceLine, makeInvoiceLineServer } from "#test/invoice-line-editor/backend.ts";
import { OneShotScreen } from "#test/invoice-line-editor/OneShot.tsx";
import { InvoiceLineCreate, InvoiceLineScreen } from "#test/invoice-line-editor/Screen.ts";
import { clickButton, typeInput } from "./Screen.ts";
import { RegistryProbe } from "./sessionProbes.ts";
export const stapler = new InvoiceLine({ id: 1, name: "Stapler", quantity: 150 });
const notebook = new InvoiceLine({ id: 2, name: "Notebook", quantity: 180 });
function controls(root: Rendered) {
	const { container } = root;
	function input(name: string) {
		return container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
	}
	return {
		alerts: () => [...container.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent),
		click: (label: string) => act(async () => clickButton(container, label)),
		container,
		error: (name: string) => container.querySelector(`[data-error="${name}"]`)?.textContent,
		render: root.render,
		status: () => container.querySelector('[role="status"]')?.textContent,
		text: () => container.textContent ?? "",
		type: (name: string, value: string) => act(async () => typeInput(container, name, value)),
		value: (name: string) => input(name)?.value,
	};
}
export async function editing(root: Rendered, id = 1) {
	const server = makeInvoiceLineServer([stapler, notebook]);
	const view = controls(root);
	const release = server.hold();
	function show(current: number) {
		return root.render(
			<SessionBoundary connect={() => undefined} identify={(session) => session} recheck={() => undefined} session="s1">
				{() => <InvoiceLineScreen id={current} server={server} />}
			</SessionBoundary>,
		);
	}
	await show(id);
	return { release, server, show, view };
}
export async function creating(root: Rendered) {
	const server = makeInvoiceLineServer([stapler]);
	const view = controls(root);
	await root.render(
		<SessionBoundary connect={() => undefined} identify={(session) => session} recheck={() => undefined} session="s1">
			{() => <InvoiceLineCreate server={server} />}
		</SessionBoundary>,
	);
	return { server, view };
}
export function switching(root: Rendered) {
	const servers = {
		alice: makeInvoiceLineServer([stapler]),
		bob: makeInvoiceLineServer([new InvoiceLine({ id: 1, name: "Envelope", quantity: 80 })]),
	};
	const rechecks: string[] = [];
	const registries: AtomRegistry.AtomRegistry[] = [];
	const view = controls(root);
	function show(session: "alice" | "bob" | undefined) {
		return root.render(
			<SessionBoundary
				connect={(user) => servers[user]}
				identify={(user) => user}
				recheck={() => rechecks.push(session ?? "none")}
				session={session}
				signedOut="Signed out"
			>
				{(server) => (
					<>
						<RegistryProbe registries={registries} />
						<InvoiceLineScreen id={stapler.id} server={server} />
					</>
				)}
			</SessionBoundary>,
		);
	}
	return { rechecks, registries, servers, show, view };
}

export async function oneShot(root: Rendered) {
	const opening = new InvoiceLine({ id: 7, name: "Stapler", quantity: 150, version: 3 });
	const server = makeInvoiceLineServer([opening]);
	const view = controls(root);
	await root.render(<OneShotScreen opening={opening} server={server} />);
	return { server, view };
}
