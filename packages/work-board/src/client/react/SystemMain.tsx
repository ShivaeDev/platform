import { Option } from "effect";
import { useContext } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionFrame } from "./ProjectionFrame.tsx";
import { navigationQuery, routeQueryOptions } from "./routeQuery.ts";
import { SessionContext } from "./SessionContext.ts";
import type { ShellApi } from "./ShellApi.ts";
import { SystemPage } from "./SystemPage.tsx";
import { useDiagnosticsPolling } from "./useDiagnosticsPolling.ts";
import { useNeedsYouCount } from "./useNeedsYouCount.ts";

export function SystemMain({
	api,
	onPage,
	url,
}: {
	readonly api: ShellApi;
	readonly onPage: (location: MainLocation) => void;
	readonly url: string;
}) {
	const atom = api.diagnostics.query(undefined, routeQueryOptions);
	useDiagnosticsPolling(useContext(SessionContext), atom, api.fleetItems.query(undefined, routeQueryOptions));
	const navigation = useQuery(navigationQuery(api), { keepPreviousData: true });
	const needsYou = useNeedsYouCount(Option.getOrUndefined(navigation.data));
	const inbox = useQuery(api.inbox.query(undefined, routeQueryOptions), { keepPreviousData: true });
	const sourceProblems = { failed: Option.isSome(inbox.cause), issues: Option.getOrUndefined(inbox.data)?.issues };
	return (
		<ProjectionFrame
			atom={atom}
			location={() => ({ file: "System", status: 200, view: "system" })}
			onPage={onPage}
			render={(data) => <SystemPage data={data} needsYou={needsYou} sourceProblems={sourceProblems} />}
			route="system"
			url={url}
		/>
	);
}
