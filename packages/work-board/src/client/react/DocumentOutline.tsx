import { cn } from "cn";
import { TableOfContents } from "lucide-react";
import { useRef, useState } from "react";
import type { Document } from "#browser/document/schema.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "#client/react/components/ui/popover.tsx";
import { type OutlineEntry, useCurrentHeading, useDocumentOutline } from "./useDocumentOutline.ts";

const indents: Readonly<Record<number, string>> = { 3: "pl-6", 4: "pl-9", 5: "pl-12", 6: "pl-12" };

function OutlineLinks({ headings, onNavigate }: { readonly headings: readonly OutlineEntry[]; readonly onNavigate?: () => void }) {
	const current = useCurrentHeading(headings);
	return (
		<ol className="m-0 list-none space-y-0.5 border-border border-l p-0">
			{headings.map((heading) => (
				<li data-depth={heading.depth} key={heading.id}>
					<a
						aria-current={heading.id === current ? "location" : undefined}
						className={cn(
							"-ml-px block border-transparent border-l-2 py-0.5 pl-3 text-muted-foreground hover:text-foreground hover:underline aria-[current=location]:border-foreground aria-[current=location]:font-medium aria-[current=location]:text-foreground",
							indents[heading.depth],
						)}
						href={`#${heading.id}`}
						onClick={onNavigate}
					>
						{heading.title || "Section"}
					</a>
				</li>
			))}
		</ol>
	);
}

export function DocumentOutline({ headings }: { readonly headings: readonly OutlineEntry[] }) {
	if (headings.length < 2) {
		return null;
	}
	return (
		<nav aria-label="Document outline" className="document-outline hidden text-sm lg:block">
			<h2 className="mt-0 mb-3 font-semibold text-sm">On this page</h2>
			<OutlineLinks headings={headings} />
		</nav>
	);
}

export function OutlineMenu({ document }: { readonly document: Document }) {
	const anchorRef = useRef<HTMLSpanElement>(null);
	const headings = useDocumentOutline(anchorRef, document);
	const [open, setOpen] = useState(false);
	return (
		<span className="contents lg:hidden" ref={anchorRef}>
			{headings.length > 1 && (
				<Popover onOpenChange={setOpen} open={open}>
					<PopoverTrigger render={<Button className="pointer-coarse:h-11" data-outline-menu size="sm" type="button" variant="outline" />}>
						<TableOfContents aria-hidden="true" />
						On this page
					</PopoverTrigger>
					<PopoverContent align="start" aria-label="On this page" className="max-h-[60vh] max-w-[calc(100vw-2rem)] overflow-y-auto text-sm">
						<nav aria-label="Document outline">
							<OutlineLinks headings={headings} onNavigate={() => setOpen(false)} />
						</nav>
					</PopoverContent>
				</Popover>
			)}
		</span>
	);
}
