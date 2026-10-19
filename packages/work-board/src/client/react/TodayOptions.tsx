import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { DocumentRequest } from "#browser/document/schema.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import { Button, buttonVariants } from "#client/react/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "#client/react/components/ui/popover.tsx";
import { fileUrl } from "#files/url.ts";
import { responseUrl } from "#responses/url.ts";
import { documentQuery } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
import { type InlineMode, TodayAnswer } from "./TodayAnswer.tsx";

function inlineMode(request: DocumentRequest | undefined): InlineMode | undefined {
	if (!request?.preview || request.unavailable || request.promptUnavailable || !request.prompts) {
		return undefined;
	}
	const [prompt, ...others] = request.prompts;
	if (!prompt) {
		return "text";
	}
	if (others.length > 0) {
		return undefined;
	}
	return prompt.mode === "one" ? "options" : prompt.mode === "text" ? "text" : undefined;
}

export function TodayOptions({ api, item }: { readonly api: ShellApi; readonly item: InboxProjection["you"][number] }) {
	const query = useQuery(documentQuery(api, fileUrl(item.file)), { keepPreviousData: true });
	const data = Option.getOrUndefined(query.data);
	const request = data?.requests.find((entry) => entry.open && responseUrl(data.metadata.id ?? "", entry.id) === item.href);
	const mode = item.problem ? undefined : inlineMode(request);
	return data && request && mode ? (
		<Popover>
			<PopoverTrigger render={<Button aria-label={`Answer ${item.title}`} className="min-w-16" size="sm" type="button" />}>Answer</PopoverTrigger>
			<PopoverContent align="end" aria-label={`Answer ${item.title}`} className="w-80 max-w-[calc(100vw-2rem)] text-sm">
				<TodayAnswer api={api} document={data} key={request.preview?.reviewedRevision} mode={mode} request={request} />
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
