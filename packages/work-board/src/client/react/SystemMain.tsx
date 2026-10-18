import { Option } from "effect";
import { useContext } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionFrame } from "./ProjectionFrame.tsx";
import { navigationQuery, routeQueryOptions } from "./routeQuery.ts";
import { SessionContext } from "./SessionContext.ts";
import type { ShellApi } from "./ShellApi.ts";
import { SystemPage } from "./SystemPage.tsx";
import { useDiagnosticsPolling } from "./useDiagnosticsPolling.ts";

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
	const needsYou = Option.getOrUndefined(navigation.data)?.inboxCount;
	return (
		<ProjectionFrame
			atom={atom}
			location={() => ({ file: "System", status: 200, view: "system" })}
			onPage={onPage}
			render={(data) => <SystemPage data={data} needsYou={needsYou} />}
			route="system"
			url={url}
		/>
	);
}
