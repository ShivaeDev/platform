import { Option } from "effect";
import { useId } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { Item } from "#client/react/LibraryContext.ts";
import { fileUrl } from "#files/url.ts";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";

function LibraryList({
	title,
	items,
	available,
	current,
	onClose,
}: {
	readonly title: string;
	readonly items: readonly Item[];
	readonly available: ReadonlySet<string>;
	readonly current: string;
	readonly onClose: () => void;
}) {
	const id = useId();
	if (items.length === 0) {
		return null;
	}
	return (
		<section className="grid gap-1">
			<h3 className="px-2 pt-3 font-semibold text-muted-foreground text-xs" id={id}>
				{title}
			</h3>
			<ul aria-labelledby={id} className="m-0 grid list-none gap-0.5 p-0">
				{items.map((item) => (
					<li className="min-w-0" key={item.file}>
						<a
							aria-current={item.file === current ? "page" : undefined}
							className="block truncate rounded-md px-2 py-1.5 text-foreground no-underline outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
							href={fileUrl(item.file)}
							onClick={onClose}
							title={item.title}
						>
							{item.title}
							{available.has(item.file) ? "" : <span className="text-muted-foreground"> (missing)</span>}
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}

export function ReadingHistory({
	api,
	onClose,
	current,
	favorites,
	recents,
}: {
	readonly api: ShellApi;
	readonly onClose: () => void;
	readonly current: string;
	readonly favorites: readonly Item[];
	readonly recents: readonly Item[];
}) {
	const query = useQuery(api.library.query({ showFleet: true }, { timeToLive: 0 }));
	const data = Option.getOrUndefined(query.data);
	const available = new Set(data ? data.files.map((file) => file.path) : [...favorites, ...recents].map((item) => item.file));
	return (
		<nav aria-label="Reading history" id={shellIds.readingLibrary}>
			<LibraryList available={available} current={current} items={favorites} onClose={onClose} title="Pinned" />
			<LibraryList available={available} current={current} items={recents} onClose={onClose} title="Recent documents" />
		</nav>
	);
}
