import type { Navigation } from "#browser/Navigation.ts";
import { DocumentMain } from "./DocumentMain.tsx";
import { documentRoute } from "./documentRoute.ts";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionMain } from "./ProjectionMain.tsx";
import { projectionRoute } from "./projectionRoute.ts";
import { RemainingMain } from "./RemainingMain.tsx";
import { remainingRoute } from "./remainingRoute.ts";
import type { ShellApi } from "./ShellApi.ts";
export function BoardMain({
	api,
	home,
	onPage,
	url,
}: {
	readonly api: ShellApi;
	readonly home: Navigation["home"];
	readonly onPage: (location: MainLocation) => void;
	readonly url: string;
}) {
	const pathname = new URL(url, "http://127.0.0.1").pathname;
	const projection = projectionRoute(pathname, home);
	if (projection) {
		return <ProjectionMain api={api} onPage={onPage} route={projection} url={url} />;
	}
	if (documentRoute(pathname, home)) {
		return <DocumentMain api={api} onPage={onPage} url={url} />;
	}
	return <RemainingMain api={api} onPage={onPage} route={remainingRoute(pathname) ?? "start"} url={url} />;
}
