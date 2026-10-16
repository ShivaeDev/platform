import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { LibraryPage } from "./LibraryPage.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionFrame } from "./ProjectionFrame.tsx";
import type { ShellApi } from "./ShellApi.ts";
export function LibraryMain({
	api,
	onPage,
	url,
}: {
	readonly api: ShellApi;
	readonly onPage: (location: MainLocation) => void;
	readonly url: string;
}) {
	return (
		<ProjectionFrame
			atom={api.library.query({}, routeQueryOptions)}
			location={() => ({ file: "Library", status: 200, view: "library" })}
			onPage={onPage}
			render={() => <LibraryPage api={api} key={url} url={url} />}
			route="library"
			url={url}
		/>
	);
}
