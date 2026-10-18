import { RegistryContext } from "@effect/atom-react";
import { Cause, Effect, Option } from "effect";
import { useContext, useMemo, useState } from "react";
import { useAction, useQuery } from "@shivaedev/effect-react/result-state.ts";
import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import { answerBody } from "#browser/responses/answerBody.ts";
import { optionLabel } from "#browser/responses/cardContext.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import { Button } from "#client/react/components/ui/Button.tsx";
import { Popover } from "#client/react/components/ui/Popover.tsx";
import { authorLabel } from "#client/responses/authorLabel.ts";
import { saveFailure } from "#client/saveFailure.ts";
import { fileUrl } from "#files/url.ts";
import { responseUrl } from "#responses/url.ts";
import { createResponse } from "./createResponse.ts";
import { useFormClient } from "./FormContext.ts";
import { documentQuery, navigationQuery, routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";

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
		<Popover label={`Answer ${item.title}`} trigger="Answer" triggerClassName="h-8 w-auto px-1 text-xs">
			<a className="mb-3 block text-xs" href={item.href}>
				Open full question
			</a>
			<InlineOptions api={api} document={data} key={request.preview.reviewedRevision} request={request} />
		</Popover>
	) : (
		<a aria-label={`Answer ${item.title}`} className="shrink-0 text-xs" href={item.href}>
			Answer
		</a>
	);
}

function InlineOptions({ api, document: data, request }: { readonly api: ShellApi; readonly document: Document; readonly request: DocumentRequest }) {
	const registry = useContext(RegistryContext);
	const client = useFormClient();
	const [label] = useState(() => authorLabel(() => localStorage, document.documentElement.dataset.workspace));
	const [author, setAuthor] = useState(() => label.read("") || "maintainer");
	const actionAtom = useMemo(
		() =>
			client.runtime.fn(
				Effect.fn("Board.answerOption")(function* (choice: string) {
					const preview = request.preview;
					const prompt = request.prompts?.[0];
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
		[client, api, registry, request, author, data.file, label.save],
	);
	const action = useAction(actionAtom);
	const failure = Option.getOrUndefined(Option.flatMap(action.cause, Cause.findErrorOption));
	const saved = Option.getOrUndefined(action.data);
	let status = saved ? `Saved: responses/${saved.id}.md. This records feedback, not acceptance.` : "";
	if (failure) {
		status = typeof failure === "string" ? failure : saveFailure(failure, "response").text;
	}
	if (action.pending) {
		status = "Pending: registering reviewed context, then recording response…";
	}
	const prompt = request.prompts?.[0];
	return (
		<fieldset aria-label={`Options for ${data.identity}`} className="m-0 min-w-0 space-y-2 border-0 px-2 pb-2">
			<div className="flex flex-wrap gap-2">
				{prompt?.options.map((option, index) => {
					const text = data.metadata.options?.[index]?.label ?? optionLabel(option.id, option.source, request.preview?.reason ?? "");
					return (
						<Button
							disabled={!(data.writable && author.trim()) || action.pending || Boolean(saved)}
							key={option.id}
							onClick={() => action.dispatch(option.id)}
							size="sm"
							variant="outline"
						>
							{text}
							{data.metadata.recommended === text && " · Recommended"}
						</Button>
					);
				})}
			</div>
			<details className="text-muted-foreground text-xs">
				<summary className="cursor-pointer">Answer as {author || "…"}</summary>
				<label>
					Local author label{" "}
					<input className="rounded border px-2 py-1" maxLength={200} onChange={(event) => setAuthor(event.currentTarget.value)} value={author} />
				</label>
			</details>
			{!data.writable && <p className="m-0 text-muted-foreground text-xs">Read-only. Enable responses to record an answer.</p>}
			{Boolean(status) && (
				<p className="m-0 text-xs" role="status">
					{status}
				</p>
			)}
		</fieldset>
	);
}
