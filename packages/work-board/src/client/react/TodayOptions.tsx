import { RegistryContext } from "@effect/atom-react";
import { Cause, Effect, Option } from "effect";
import { useContext, useId, useMemo, useRef, useState } from "react";
import { useAction, useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import { answerBody } from "#browser/responses/answerBody.ts";
import { promptHeading } from "#browser/responses/cardContext.ts";
import { reasonMarkdown } from "#browser/responses/reasonMarkdown.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { Input } from "#client/react/components/ui/input.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "#client/react/components/ui/popover.tsx";
import { authorLabel } from "#client/responses/authorLabel.ts";
import { chosenLabels } from "#client/responses/summary.ts";
import { saveFailure } from "#client/saveFailure.ts";
import { fileUrl } from "#files/url.ts";
import { responseUrl } from "#responses/url.ts";
import { createResponse } from "./createResponse.ts";
import { useFormClient } from "./FormContext.ts";
import { documentQuery, navigationQuery, routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
import { TodayOptionButton } from "./TodayOptionButton.tsx";

export function TodayOptions({ api, item }: { readonly api: ShellApi; readonly item: InboxProjection["you"][number] }) {
	const query = useQuery(documentQuery(api, fileUrl(item.file)), { keepPreviousData: true });
	const data = Option.getOrUndefined(query.data);
	const request = data?.requests.find((entry) => entry.open && responseUrl(data.metadata.id ?? "", entry.id) === item.href);
	return data
		&& !item.problem
		&& request?.preview
		&& !request.unavailable
		&& !request.promptUnavailable
		&& request.prompts?.length === 1
		&& request.prompts[0]?.mode === "one" ? (
		<Popover>
			<PopoverTrigger
				render={<Button aria-label={`Answer ${item.title}`} className="shrink-0 px-1 text-xs" size="sm" type="button" variant="ghost" />}
			>
				Answer
			</PopoverTrigger>
			<PopoverContent align="end" aria-label={`Answer ${item.title}`} className="w-80 max-w-[calc(100vw-2rem)] text-sm">
				<InlineOptions api={api} document={data} key={request.preview.reviewedRevision} request={request} />
				<a className="mt-3 block border-t px-2 pt-2 text-muted-foreground text-xs hover:text-foreground" href={item.href}>
					Open the full question with its context →
				</a>
			</PopoverContent>
		</Popover>
	) : (
		<a aria-label={`Answer ${item.title}`} className="shrink-0 text-xs" href={item.href}>
			Answer
		</a>
	);
}

function InlineOptions({ api, document: data, request }: { readonly api: ShellApi; readonly document: Document; readonly request: DocumentRequest }) {
	const registry = useContext(RegistryContext);
	const authorId = useId();
	const requestRef = useRef(request);
	requestRef.current = request;
	const client = useFormClient();
	const [label] = useState(() => authorLabel(() => localStorage, document.documentElement.dataset.workspace));
	const [author, setAuthor] = useState(() => label.read("") || "maintainer");
	const actionAtom = useMemo(
		() =>
			client.runtime.fn(
				Effect.fn("Board.answerOption")(function* (choice: string) {
					const preview = requestRef.current.preview;
					const prompt = requestRef.current.prompts?.[0];
					if (!(preview && prompt && author.trim())) {
						return yield* Effect.fail("Add your local author label.");
					}
					const answers = [{ prompt: prompt.id, selected: [choice], text: "" }];
					const submission = {
						answers,
						author: author.trim(),
						body: answerBody([prompt], answers, ""),
						id: `response.${crypto.randomUUID()}`,
						question: preview.id,
						revision: preview.reviewedRevision,
						type: "answer" as const,
					};
					const saved = yield* createResponse(client, preview, submission);
					label.save(author);
					registry.refresh(api.inbox.query(undefined, routeQueryOptions));
					registry.refresh(navigationQuery(api));
					registry.refresh(documentQuery(api, fileUrl(data.file)));
					return saved;
				}),
			),
		[client, api, registry, author, data.file, label.save],
	);
	const action = useAction(actionAtom);
	const failure = Option.getOrUndefined(Option.flatMap(action.cause, Cause.findErrorOption));
	const saved = Option.getOrUndefined(action.data);
	let status = saved
		? `Saved: your answer “${chosenLabels(request.prompts ?? [], saved.answers)}” is recorded. The agent reads it the next time it checks.`
		: "";
	if (failure) {
		status = typeof failure === "string" ? failure : saveFailure(failure, "response").text;
	}
	if (action.pending) {
		status = "Pending: registering reviewed context, then recording response…";
	}
	const prompt = request.prompts?.[0];
	const reason = reasonMarkdown(request.preview?.reason ?? "").split("\n")[0];
	return (
		<fieldset aria-label={`Options for ${data.identity}`} className="m-0 min-w-0 space-y-3 border-0 px-2 pb-1">
			{Boolean(reason) && <p className="m-0 font-medium text-sm">{reason}</p>}
			{prompt ? <p className="m-0 text-muted-foreground text-xs">{promptHeading(prompt.source).title ?? "Choose one option."}</p> : null}
			<div className="grid gap-2">
				{prompt?.options.map((option, index) => (
					<TodayOptionButton
						disabled={!(data.writable && author.trim()) || action.pending || Boolean(saved)}
						key={option.id}
						onChoose={() => action.dispatch(option.id)}
						option={option}
						recommended={data.metadata.recommended}
						source={data.metadata.options?.[index]}
					/>
				))}
			</div>
			<details className="text-muted-foreground text-xs">
				<summary className="cursor-pointer">Answer as {author || "…"}</summary>
				<div className="mt-2 flex items-center gap-2">
					<Label className="shrink-0 font-normal text-xs" htmlFor={authorId}>
						Local author label
					</Label>
					<Input className="h-8 text-xs" id={authorId} maxLength={200} onChange={(event) => setAuthor(event.currentTarget.value)} value={author} />
				</div>
			</details>
			{!data.writable && <p className="m-0 text-muted-foreground text-xs">This Board is read-only. Start it with --responses to record answers.</p>}
			{Boolean(status) && (
				<p className="m-0 text-xs" role="status">
					{status}
				</p>
			)}
		</fieldset>
	);
}
