import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { InvoiceLine, makeInvoiceLineServer } from "#test/invoice-line-editor/backend.ts";
import { OneShotScreen } from "#test/invoice-line-editor/OneShot.tsx";
import { InvoiceLineCreate, InvoiceLineScreen } from "#test/invoice-line-editor/Screen.ts";
import { SessionRegistry } from "#test/SessionRegistry.tsx";

export const stapler = new InvoiceLine({ id: 1, name: "Stapler", quantity: 150 });
const notebook = new InvoiceLine({ id: 2, name: "Notebook", quantity: 180 });

export type Session = "alice" | "bob";

export function editing(root: Rendered) {
	const server = makeInvoiceLineServer([stapler, notebook]);
	return {
		server,
		show: (id: number) =>
			root.render(
				<SessionBoundary connect={() => undefined} identify={(session) => session} recheck={() => undefined} session="s1">
					{() => <InvoiceLineScreen id={id} server={server} />}
				</SessionBoundary>,
			),
	};
}

export function creating(root: Rendered) {
	const server = makeInvoiceLineServer([stapler]);
	return {
		server,
		show: () =>
			root.render(
				<SessionBoundary connect={() => undefined} identify={(session) => session} recheck={() => undefined} session="s1">
					{() => <InvoiceLineCreate server={server} />}
				</SessionBoundary>,
			),
	};
}

export function oneShot(root: Rendered) {
	const opening = new InvoiceLine({ id: 7, name: "Stapler", quantity: 150, version: 3 });
	const server = makeInvoiceLineServer([opening]);
	return { server, show: () => root.render(<OneShotScreen opening={opening} server={server} />) };
}

export function switching(root: Rendered) {
	const servers = {
		alice: makeInvoiceLineServer([stapler]),
		bob: makeInvoiceLineServer([new InvoiceLine({ id: 1, name: "Envelope", quantity: 80 })]),
	};
	const rechecks: string[] = [];
	const registries: Partial<Record<Session, AtomRegistry.AtomRegistry>> = {};
	function show(session: Session | undefined) {
		function handleRegistry(registry: AtomRegistry.AtomRegistry) {
			if (session) {
				registries[session] ??= registry;
			}
		}
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
						<SessionRegistry onRegistry={handleRegistry} />
						<InvoiceLineScreen id={stapler.id} server={server} />
					</>
				)}
			</SessionBoundary>,
		);
	}
	return { rechecks, registries, servers, show };
}
