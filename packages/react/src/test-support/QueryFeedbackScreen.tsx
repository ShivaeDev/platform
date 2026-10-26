import { CatchBoundary } from "@tanstack/react-router";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { QueryView } from "#client/QueryView.ts";
import { type QueryOptions, useQuery } from "#client/resultState.ts";
import type { Unavailable } from "./queryView.ts";

function UnexpectedFailure() {
	return <p data-crash>Unexpected failure</p>;
}

function Feedback({ atom, options }: { readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, Unavailable>>; readonly options: QueryOptions }) {
	const query = useQuery(atom, options);
	return (
		<>
			<button onClick={query.refresh} type="button">
				Refresh
			</button>
			<QueryView
				content={(value) => (
					<article>
						<output>{value}</output>
						<input defaultValue="Local input" name="local" />
					</article>
				)}
				failure={(error, state) => (
					<aside role="alert">
						{error.message}
						<button disabled={state.pending} onClick={state.refresh} type="button">
							Retry
						</button>
					</aside>
				)}
				loading={(state) => <p role="status">{state.refreshing ? "Refreshing" : "Loading"}</p>}
				query={query}
			/>
		</>
	);
}

export function QueryFeedbackScreen(props: Parameters<typeof Feedback>[0]) {
	return (
		<section>
			<input defaultValue="Shell input" name="shell" />
			<CatchBoundary errorComponent={UnexpectedFailure} getResetKey={() => "query"}>
				<Feedback {...props} />
			</CatchBoundary>
		</section>
	);
}
