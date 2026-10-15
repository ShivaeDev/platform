import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { fileUrl } from "#files/url.ts";
import type { Item } from "./readingLibrary.ts";
import type { ShellApi } from "./ShellApi.ts";

function LibraryList({
	title,
	items,
	available,
	current,
	close,
}: {
	readonly title: string;
	readonly items: readonly Item[];
	readonly available: ReadonlySet<string>;
	readonly current: string;
	readonly close: () => void;
}) {
	function handleCloseLink(event: React.MouseEvent<HTMLAnchorElement>) {
		event.currentTarget.closest("dialog")?.close("navigate");
		close();
	}

	if (items.length === 0) {
		return null;
	}
	return (
		<>
			<h2 className="nav-heading">{title}</h2>
			<ul>
				{items.map((item) => (
					<li key={item.file}>
						<a
							aria-current={item.file === current ? "page" : undefined}
							className={available.has(item.file) ? undefined : "missing"}
							href={fileUrl(item.file)}
							onClick={handleCloseLink}
						>
							{item.title}
							{available.has(item.file) ? "" : " (missing)"}
						</a>
					</li>
				))}
			</ul>
		</>
	);
}

export function ReadingHistory({
	api,
	close,
	current,
	favorites,
	recents,
}: {
	readonly api: ShellApi;
	readonly close: () => void;
	readonly current: string;
	readonly favorites: readonly Item[];
	readonly recents: readonly Item[];
}) {
	const query = useQuery(api.library.query({ showFleet: true }, { timeToLive: 0 }));
	const data = Option.getOrUndefined(query.data);
	const available = new Set(data ? data.files.map((file) => file.path) : [...favorites, ...recents].map((item) => item.file));
	return (
		<>
			<LibraryList available={available} close={close} current={current} items={favorites} title="Favorites" />
			<LibraryList available={available} close={close} current={current} items={recents} title="Recent documents" />
		</>
	);
}
