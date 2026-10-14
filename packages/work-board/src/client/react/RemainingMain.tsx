import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { ChangesMain } from "./ChangesMain.tsx";
import { DiagnosticsMain } from "./DiagnosticsMain.tsx";
import { GoalsPage } from "./GoalsPage.tsx";
import { HandoffPage } from "./HandoffPage.tsx";
import { LibraryMain } from "./LibraryMain.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionFrame } from "./ProjectionFrame.tsx";
import { RespondPage } from "./RespondPage.tsx";
import { ResultPage } from "./ResultPage.tsx";
import type { RemainingRoute } from "./remainingRoute.ts";
import type { ShellApi } from "./ShellApi.ts";
import { StartPage } from "./StartPage.tsx";
export function RemainingMain({
	api,
	onPage,
	route,
	url,
}: {
	readonly api: ShellApi;
	readonly onPage: (location: MainLocation) => void;
	readonly route: RemainingRoute;
	readonly url: string;
}) {
	const options = { onPage, route, url };
	switch (route) {
		case "library":
			return <LibraryMain api={api} onPage={onPage} url={url} />;
		case "goals":
			return (
				<ProjectionFrame
					{...options}
					atom={api.goals.query(undefined, routeQueryOptions)}
					location={() => ({ file: "Goals", status: 200, view: "goals" })}
					render={(data) => <GoalsPage data={data} />}
				/>
			);
		case "changes":
			return <ChangesMain api={api} onPage={onPage} url={url} />;
		case "start":
			return (
				<ProjectionFrame
					{...options}
					atom={api.start.query(undefined, routeQueryOptions)}
					location={() => ({ file: "Getting started", status: 200, view: "start" })}
					render={(data) => <StartPage data={data} />}
				/>
			);
		case "diagnostics":
			return <DiagnosticsMain api={api} onPage={onPage} url={url} />;
		case "respond":
			return (
				<ProjectionFrame
					{...options}
					atom={api.respond.query({ url }, routeQueryOptions)}
					location={() => ({ file: "Respond", status: 200, view: "response" })}
					render={(data) => <RespondPage data={data} />}
				/>
			);
		case "handoff":
			return (
				<ProjectionFrame
					{...options}
					atom={api.handoff.query({ url }, routeQueryOptions)}
					location={(data) => ({ file: "Handoff", status: data.source || data.reading.records.length > 0 ? 200 : 409, view: "handoff" })}
					render={(data) => <HandoffPage data={data} />}
				/>
			);
		case "result":
			return (
				<ProjectionFrame
					{...options}
					atom={api.result.query({ url }, routeQueryOptions)}
					location={() => ({ file: "Result review", status: 200, view: "result" })}
					render={(data) => <ResultPage data={data} />}
				/>
			);
	}
}
