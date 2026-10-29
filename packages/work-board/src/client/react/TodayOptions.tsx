import { Option } from "effect";
import { type ReactNode, useRef, useState } from "react";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import { Button, buttonVariants } from "#client/react/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "#client/react/components/ui/popover.tsx";
import { Sheet, SheetContent, SheetTrigger } from "#client/react/components/ui/sheet.tsx";
import { fileUrl } from "#files/url.ts";
import { responseUrl } from "#responses/url.ts";
import { documentQuery } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
import { TodayAnswer } from "./TodayAnswer.tsx";
import { TodayReadOnly } from "./TodayReadOnly.tsx";
import { inlineAnswer } from "./todayInline.ts";
import { useMedia } from "./useMedia.ts";

const ACTION = "min-w-16 pointer-coarse:h-11";

export function TodayOptions({
	api,
	item,
	onSaved,
}: {
	readonly api: ShellApi;
	readonly item: InboxProjection["you"][number];
	readonly onSaved: () => void;
}) {
	const [open, setOpen] = useState(false);
	const narrow = useMedia("(max-width: 767px)");
	const focusRef = useRef<HTMLElement>(null);
	const query = useQuery(documentQuery(api, fileUrl(item.file)), { keepPreviousData: true });
	const data = Option.getOrUndefined(query.data);
	const request = data?.requests.find((entry) => entry.open && responseUrl(data.metadata.id ?? "", entry.id) === item.href);
	const inline = inlineAnswer(request);
	if (!(data && inline)) {
		return (
			<a aria-label={`Open ${item.title}`} className={buttonVariants({ className: ACTION, size: "sm" })} href={item.href}>
				Open
			</a>
		);
	}
	const label = `Answer ${item.title}`;
	const trigger = <Button aria-label={label} className={ACTION} size="sm" type="button" />;
	function initialFocus() {
		return focusRef.current ?? true;
	}
	const content: ReactNode = (
		<>
			{data.writable ? (
				<TodayAnswer
					api={api}
					document={data}
					focusRef={focusRef}
					href={item.href}
					inline={inline}
					key={inline.preview.reviewedRevision}
					onSaved={() => {
						setOpen(false);
						onSaved();
					}}
					title={item.title}
				/>
			) : (
				<TodayReadOnly document={data} inline={inline} />
			)}
			<a className="text-muted-foreground hover:text-foreground mt-3 block border-t px-2 pt-2 text-xs" href={item.href}>
				Read the full question
			</a>
		</>
	);
	return narrow ? (
		<Sheet onOpenChange={setOpen} open={open}>
			<SheetTrigger render={trigger}>Answer</SheetTrigger>
			<SheetContent
				aria-label={label}
				className="max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-2xl px-2 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm"
				initialFocus={initialFocus}
				side="bottom"
			>
				<p className="text-muted-foreground m-0 truncate px-2 pr-12 text-xs font-medium">{item.title}</p>
				{content}
			</SheetContent>
		</Sheet>
	) : (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger render={trigger}>Answer</PopoverTrigger>
			<PopoverContent
				align="end"
				aria-label={label}
				className="max-h-[min(32rem,var(--available-height))] w-lg max-w-[calc(100vw-2rem)] overflow-y-auto text-sm"
				initialFocus={initialFocus}
			>
				{content}
			</PopoverContent>
		</Popover>
	);
}
