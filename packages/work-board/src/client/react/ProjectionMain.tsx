import { documentSourceId } from "#client/document/layout.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { HomeBoard } from "./HomeBoard.tsx";
import { InboxPage } from "./InboxPage.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { OverviewPage } from "./OverviewPage.tsx";
import { ProjectionFrame } from "./ProjectionFrame.tsx";
import type { ProjectionRoute } from "./projectionRoute.ts";
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
					location={(data) => ({ file: "Today", status: data.complete ? 200 : 503, view: "today" })}
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
					location={(data) => ({ file: "Work", status: data.validBoard ? 200 : 404, view: "work" })}
					render={(data) => <WorkPage api={api} data={data} />}
					source={(data) => (data.selected ? documentSourceId(data.selected) : undefined)}
				/>
			);
		case "overview":
			return (
				<ProjectionFrame
					{...options}
					atom={api.overview.query(undefined, routeQueryOptions)}
					location={(data) => ({ file: "Overview", status: data.complete ? 200 : 503, view: "overview" })}
					render={(data) => <OverviewPage data={data} />}
				/>
			);
		case "inbox":
			return (
				<ProjectionFrame
					{...options}
					atom={api.inbox.query(undefined, routeQueryOptions)}
					location={(data) => ({ file: "Inbox", status: data.complete ? 200 : 503, view: "inbox" })}
					render={(data) => <InboxPage data={data} />}
				/>
			);
	}
}
