import { type ReactNode, useContext } from "react";
import { EmptyState } from "#client/react/EmptyState.tsx";
import { type Item, LibraryContext, otherRecents } from "#client/react/LibraryContext.ts";
import { fileUrl } from "#files/url.ts";

export function PinnedLinks({ current }: { readonly current: string }) {
	const reading = useContext(LibraryContext);
	return (
		<ReadingLinks
			current={current}
			empty={
				<EmptyState compact title="No pinned documents">
					Pin a document to keep it here.
				</EmptyState>
			}
			items={reading.favorites}
			title="Pinned"
		/>
	);
}

export function RecentLinks({ current }: { readonly current: string }) {
	const reading = useContext(LibraryContext);
	return (
		<ReadingLinks
			current={current}
			empty={
				<EmptyState compact title="No recent documents">
					Documents you open appear here.
				</EmptyState>
			}
			items={otherRecents(reading, current).slice(0, 5)}
			title="Recent"
		/>
	);
}

function ReadingLinks({
	title,
	empty,
	items,
	current,
}: {
	readonly title: string;
	readonly empty: ReactNode;
	readonly items: readonly Item[];
	readonly current: string;
}) {
	return (
		<section aria-label={title}>
			<h2 className="text-muted-foreground mb-2 px-2 text-xs font-semibold">{title}</h2>
			<ul className="m-0 grid list-none gap-1 p-0">
				{items.map((item) => (
					<li className="min-w-0" key={item.file}>
						<a
							aria-current={item.file === current ? "page" : undefined}
							className="text-foreground hover:bg-muted focus-visible:ring-ring/50 block truncate rounded-md px-2 py-1 text-sm no-underline outline-none focus-visible:ring-3 aria-[current=page]:font-medium"
							href={fileUrl(item.file)}
							title={item.title}
						>
							{item.title}
						</a>
					</li>
				))}
			</ul>
			{items.length === 0 && empty}
		</section>
	);
}
