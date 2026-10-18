import { useContext } from "react";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionFrame } from "./ProjectionFrame.tsx";
import { routeQueryOptions } from "./routeQuery.ts";
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
	return (
		<ProjectionFrame
			atom={atom}
			location={() => ({ file: "System", status: 200, view: "system" })}
			onPage={onPage}
			render={(data) => <SystemPage data={data} />}
			route="system"
			url={url}
		/>
	);
}
