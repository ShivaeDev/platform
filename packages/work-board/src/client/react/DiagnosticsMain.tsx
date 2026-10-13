import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { DiagnosticsPage } from "./DiagnosticsPage.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionFrame } from "./ProjectionFrame.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { useDiagnosticsPolling } from "./useDiagnosticsPolling.ts";

export function DiagnosticsMain({
	api,
	onPage,
	url,
}: {
	readonly api: ShellApi;
	readonly onPage: (location: MainLocation) => void;
	readonly url: string;
}) {
	const atom = api.diagnostics.query(undefined, routeQueryOptions);
	useDiagnosticsPolling(atom);
	return (
		<ProjectionFrame
			atom={atom}
			location={() => ({ file: "Diagnostics", status: 200, view: "diagnostics" })}
			onPage={onPage}
			render={(data) => <DiagnosticsPage data={data} />}
			route="diagnostics"
			url={url}
		/>
	);
}
