import { documentSourceId } from "#client/document/layout.ts";
import { HomeBoard } from "./HomeBoard.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionFrame } from "./ProjectionFrame.tsx";
import { pageFailureCauses } from "./pageFailureCauses.ts";
import type { ProjectionRoute } from "./projectionRoute.ts";
import { routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
import { TodayPage } from "./TodayPage.tsx";
import { WorkPage } from "./WorkPage.tsx";
export function ProjectionMain({
	api,
	route,
	url,
	onPage,
}: {
	readonly api: ShellApi;
	readonly route: ProjectionRoute;
	readonly url: string;
	readonly onPage: (location: MainLocation) => void;
}) {
	const options = { onPage, route, url };
	switch (route) {
		case "today":
			return (
				<ProjectionFrame
					{...options}
					atom={api.inbox.query(undefined, routeQueryOptions)}
					location={(data) => ({
						failure: data.complete ? undefined : pageFailureCauses.unavailable,
						file: "Today",
						status: data.complete ? 200 : 503,
						view: "today",
					})}
					render={(data) => <TodayPage api={api} data={data} />}
				/>
			);
		case "board":
			return (
				<ProjectionFrame
					{...options}
					atom={api.board.query({ url }, routeQueryOptions)}
					location={(data) => ({ file: data.document.file, identity: data.document.identity, status: 200, view: "" })}
					render={(data) => <HomeBoard data={data} />}
					source={(data) => documentSourceId(data.document)}
				/>
			);
		case "work":
			return (
				<ProjectionFrame
					{...options}
					atom={api.work.query({ url }, routeQueryOptions)}
					location={(data) => ({
						failure: data.validBoard ? undefined : pageFailureCauses.notFound,
						file: "Work",
						status: data.validBoard ? 200 : 404,
						view: "work",
					})}
					render={(data) => <WorkPage api={api} data={data} />}
					source={(data) => (data.selected ? documentSourceId(data.selected) : undefined)}
				/>
			);
	}
}
