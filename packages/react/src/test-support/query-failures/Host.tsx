import type { RouterHistory } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { createContext, type ReactElement, type ReactNode, useContext } from "react";
import type { ClientApp } from "#client/app.ts";
import { NoticeHost } from "#client/notices.ts";
import type { FailureLayout } from "#client/QueryView.ts";
import { SessionApp } from "#client/SessionApp.ts";
import type { UnexpectedFailure } from "#client/unexpectedFailure.ts";

const auth = { signOut: Atom.make(AsyncResult.initial<unknown, unknown>()) };
const alice = { user: { id: "alice", permissions: [] } };

export interface Wording {
	readonly failure?: ((failure: UnexpectedFailure) => { readonly message: string }) | undefined;
	readonly loadFailure?: ((props: FailureLayout) => ReactElement) | undefined;
}

const HostWordingContext = createContext<Wording>({});

function Shell({ children }: { readonly children: ReactNode }) {
	return <NoticeHost failure={useContext(HostWordingContext).failure}>{children}</NoticeHost>;
}

// The application's one place for failures: the notice host in its shell, and optionally its own screen for a route that could not load.
export function Host({ app, history, wording }: { readonly app: ClientApp; readonly history: RouterHistory; readonly wording: Wording }) {
	return (
		<HostWordingContext.Provider value={wording}>
			<SessionApp
				app={app}
				auth={auth}
				history={history}
				{...(wording.loadFailure === undefined ? {} : { loadFailure: wording.loadFailure })}
				recheck={() => undefined}
				session={alice}
				shell={Shell}
			/>
		</HostWordingContext.Provider>
	);
}
