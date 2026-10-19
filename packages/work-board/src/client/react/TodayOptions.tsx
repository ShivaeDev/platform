import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import { Button, buttonVariants } from "#client/react/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "#client/react/components/ui/popover.tsx";
import { fileUrl } from "#files/url.ts";
import { responseUrl } from "#responses/url.ts";
import { documentQuery } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
import { TodayAnswer } from "./TodayAnswer.tsx";
import { TodayReadOnly } from "./TodayReadOnly.tsx";
import { inlineAnswer } from "./todayInline.ts";

export function TodayOptions({ api, item }: { readonly api: ShellApi; readonly item: InboxProjection["you"][number] }) {
	const query = useQuery(documentQuery(api, fileUrl(item.file)), { keepPreviousData: true });
	const data = Option.getOrUndefined(query.data);
	const request = data?.requests.find((entry) => entry.open && responseUrl(data.metadata.id ?? "", entry.id) === item.href);
	const inline = inlineAnswer(request);
	return data && inline ? (
		<Popover>
			<PopoverTrigger render={<Button aria-label={`Answer ${item.title}`} className="min-w-16" size="sm" type="button" />}>Answer</PopoverTrigger>
			<PopoverContent align="end" aria-label={`Answer ${item.title}`} className="w-80 max-w-[calc(100vw-2rem)] text-sm">
				{data.writable ? (
					<TodayAnswer api={api} document={data} inline={inline} key={inline.preview.reviewedRevision} />
				) : (
					<TodayReadOnly document={data} inline={inline} />
				)}
				<a className="mt-3 block border-t px-2 pt-2 text-muted-foreground text-xs hover:text-foreground" href={item.href}>
					Open question
				</a>
			</PopoverContent>
		</Popover>
	) : (
		<a aria-label={`Open ${item.title}`} className={buttonVariants({ className: "min-w-16", size: "sm" })} href={item.href}>
			Open
		</a>
	);
}
