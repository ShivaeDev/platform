import type { Item } from "#client/react/LibraryContext.ts";
import { fileUrl } from "#files/url.ts";

export function ReadingLinks({ title, items, current }: { readonly title: string; readonly items: readonly Item[]; readonly current: string }) {
	return (
		<section aria-label={title}>
			<h2 className="mb-2 px-2 font-semibold text-muted-foreground text-xs">{title}</h2>
			<ul className="m-0 grid list-none gap-1 p-0">
				{items.map((item) => (
					<li className="min-w-0" key={item.file}>
						<a
							aria-current={item.file === current ? "page" : undefined}
							className="block truncate rounded-md px-2 py-1 text-foreground text-sm no-underline outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:font-medium"
							href={fileUrl(item.file)}
							title={item.title}
						>
							{item.title}
						</a>
					</li>
				))}
			</ul>
			{items.length === 0 && (
				<p className="px-2 text-muted-foreground text-xs">{title === "Pinned" ? "Pin a document to keep it here." : "No recent documents."}</p>
			)}
		</section>
	);
}
