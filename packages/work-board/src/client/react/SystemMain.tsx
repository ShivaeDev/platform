import { routeQueryOptions } from "#client/page/routeQuery.ts";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionFrame } from "./ProjectionFrame.tsx";
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
	useDiagnosticsPolling(atom, api.fleetItems.query(undefined, routeQueryOptions));
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
