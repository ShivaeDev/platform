import type { ReactNode } from "react";
import type { DocumentRequest } from "#browser/document/schema.ts";
import { chosenLabels } from "#browser/responses/cardContext.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { FormField } from "./FormField.tsx";
import { shellIds } from "./shellIds.ts";
import type { useResponseForm } from "./useResponseForm.ts";

const KINDS = [
	{ label: "An answer (no is an answer too)", value: "answer" },
	{ label: "A question back (it keeps waiting for you)", value: "clarify" },
	{ label: "Not now (it keeps waiting for you)", value: "not_now" },
];

export function AnswerMore({
	body,
	id,
	request,
	state,
}: {
	readonly body?: ReactNode;
	readonly id: (value: string) => string;
	readonly request: DocumentRequest;
	readonly state: ReturnType<typeof useResponseForm>;
}) {
	const earlier = request.responses ?? [];
	const replaces = [
		{ label: "No, add this as another answer", value: "" },
		...earlier.map((record) => {
			const chosen = chosenLabels(request.prompts ?? [], record.response.answers, request.options);
			const whose = record.response.author === state.author ? "your" : `${record.response.author}'s`;
			return { label: `Yes, replace ${whose} answer${chosen ? `: ${chosen}` : ""}`, value: record.id };
		}),
	];
	return (
		<details className="group rounded-lg border px-4 py-2 text-sm [&[open]]:pb-4" data-key="response-details">
			<summary className="text-muted-foreground hover:text-foreground cursor-pointer py-1 select-none">More options</summary>
			<div className="mt-3 grid gap-4">
				<FormField form={state.form} label="Kind of reply" name="type" options={KINDS} />
				{body}
				{earlier.length > 0 && <FormField form={state.form} label="Replace an earlier answer?" name="supersedes" options={replaces} />}
				<pre className="bg-muted rounded-md p-3 text-xs whitespace-pre-wrap" hidden={!state.recovery} id={id(shellIds.responseDraftRecovery)}>
					{state.recovery}
				</pre>
				<p className="text-muted-foreground text-xs">This browser keeps your draft for seven days after your last edit.</p>
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={typeof window === "undefined" || state.created.saving}
						id={id(shellIds.responsePreview)}
						onClick={state.showPreview}
						size="sm"
						type="button"
						variant="outline"
					>
						Preview Markdown
					</Button>
					<Button
						disabled={typeof window === "undefined" || state.created.saving}
						id={id(shellIds.responseClear)}
						onClick={state.clear}
						size="sm"
						type="button"
						variant="ghost"
					>
						Clear draft
					</Button>
				</div>
				<pre className="bg-muted rounded-md p-3 text-xs whitespace-pre-wrap" hidden={!state.preview} id={id(shellIds.responsePreviewContent)}>
					{state.preview}
				</pre>
			</div>
		</details>
	);
}
