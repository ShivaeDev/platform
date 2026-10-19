import { LibraryPage } from "./LibraryPage.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { ProjectionFrame } from "./ProjectionFrame.tsx";
import { libraryQuery } from "./routeQuery.ts";
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
			atom={libraryQuery(api, url)}
			location={() => ({ file: "Library", status: 200, view: "library" })}
			onPage={onPage}
			render={(data) => <LibraryPage api={api} data={data} key={url} url={url} />}
			route="library"
			url={url}
		/>
	);
}
