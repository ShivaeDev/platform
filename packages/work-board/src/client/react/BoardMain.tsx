import type { Navigation } from "#browser/navigation/schema.ts";
import { DocumentMain } from "./DocumentMain.tsx";
import { documentRoute } from "./documentRoute.ts";
import { LegacyMain } from "./LegacyMain.tsx";
import type { MainLocation } from "./legacyPage.ts";
import { ProjectionMain } from "./ProjectionMain.tsx";
import { projectionRoute } from "./projectionRoute.ts";
import type { ShellApi } from "./ShellApi.ts";
export function BoardMain({
	api,
	home,
	initial,
	onPage,
	url,
}: {
	readonly api: ShellApi;
	readonly home: Navigation["home"];
	readonly initial: string;
	readonly onPage: (location: MainLocation) => void;
	readonly url: string;
}) {
	const pathname = new URL(url, "http://127.0.0.1").pathname;
	const projection = projectionRoute(pathname, home);
	if (projection) {
		return <ProjectionMain api={api} onPage={onPage} route={projection} url={url} />;
	}
	if (documentRoute(pathname, home)) {
		return <DocumentMain api={api} initial={initial} onPage={onPage} url={url} />;
	}
	return <LegacyMain api={api} initial={initial} onPage={onPage} url={url} />;
}
