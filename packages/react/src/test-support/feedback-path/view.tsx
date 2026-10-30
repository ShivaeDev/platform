import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { StrictMode } from "react";
import { QueryView } from "#client/QueryView.ts";
import { useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { type Notice, NoticeHost } from "#notices.ts";
import type { NoticeClient } from "#test/notices/client.ts";
import { NoticeCard } from "#test/notices/view.tsx";
import { SessionRegistry } from "#test/SessionRegistry.tsx";
import { Commands } from "./Commands.tsx";
import { Form } from "./Form.tsx";

export interface FeatureScreen {
	readonly callbacks: string[];
	readonly client: NoticeClient;
	readonly finished: string[];
	readonly notices: Map<string, Notice>;
	readonly registries: AtomRegistry.AtomRegistry[];
	readonly session: string;
	readonly uninterruptible: boolean;
}
function Feature({ state }: { readonly state: FeatureScreen }) {
	const list = useQuery(state.client.api.list.query(), { notice: ({ refreshing }) => ({ message: refreshing ? "Refresh failed" : "Load failed" }) });
	return (
		<main>
			<h1>Notes</h1>
			<QueryView
				content={(rows) => (
					<section>
						<output data-rows="">{rows}</output>
						<Form client={state.client} />
						<Commands state={state} />
					</section>
				)}
				failure={(_error, query) => (
					<p role="alert">
						Could not load notes{" "}
						<button disabled={query.pending} onClick={query.refresh} type="button">
							Retry
						</button>
					</p>
				)}
				loading={(query) => <p data-loading="">{query.refreshing ? "Refreshing notes" : "Loading notes"}</p>}
				query={list}
			/>
			<button disabled={list.pending} onClick={list.refresh} type="button">
				Refresh
			</button>
		</main>
	);
}
export function FeedbackView({ state }: { readonly state: FeatureScreen }) {
	function handleRegistry(registry: AtomRegistry.AtomRegistry) {
		if (!state.registries.includes(registry)) {
			state.registries.push(registry);
		}
	}
	return (
		<StrictMode>
			<SessionBoundary connect={() => state.client} identify={(id: string) => id} recheck={() => undefined} session={state.session}>
				{(client) => (
					<NoticeHost
						render={(notice) => {
							state.notices.set(String(notice.message), notice);
							return <NoticeCard {...notice} />;
						}}
					>
						<SessionRegistry onRegistry={handleRegistry} />
						<Feature state={{ ...state, client }} />
					</NoticeHost>
				)}
			</SessionBoundary>
		</StrictMode>
	);
}
