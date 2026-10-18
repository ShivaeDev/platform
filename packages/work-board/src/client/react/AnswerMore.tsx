import type { ReactNode } from "react";
import type { DocumentRequest } from "#browser/document/schema.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { FormField } from "./FormField.tsx";
import { shellIds } from "./shellIds.ts";
import type { useResponseForm } from "./useResponseForm.ts";

const KINDS = [
	{ label: "Answer (including no)", value: "answer" },
	{ label: "Ask back / clarify", value: "clarify" },
	{ label: "Not now", value: "not_now" },
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
	const supersedes = [
		{ label: "Adds feedback; does not supersede", value: "" },
		...(request.responses ?? []).map((record) => ({
			label: `${record.id} · ${record.response.author} · ${record.response.reviewedRevision.slice(0, 12)}`,
			value: record.id,
		})),
	];
	return (
		<details className="group rounded-lg border px-4 py-2 text-sm [&[open]]:pb-4" data-key="response-details">
			<summary className="cursor-pointer select-none py-1 text-muted-foreground hover:text-foreground">More options</summary>
			<div className="mt-3 grid gap-4">
				<FormField
					autoComplete="nickname"
					form={state.form}
					label="Local author label"
					maxLength={200}
					name="author"
					required
					showErrors={state.attempted}
				/>
				<FormField form={state.form} label="Response kind" name="type" options={KINDS} />
				{body}
				<FormField form={state.form} label="Supersedes an earlier response (optional)" name="supersedes" options={supersedes} />
				<pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs" hidden={!state.recovery} id={id(shellIds.responseDraftRecovery)}>
					{state.recovery}
				</pre>
				<p className="text-muted-foreground text-xs">
					Drafts stay in this browser for seven days after the last edit, with a 256 KiB limit per draft. Saved responses are Markdown files in
					responses/.
				</p>
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
				<pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs" hidden={!state.preview} id={id(shellIds.responsePreviewContent)}>
					{state.preview}
				</pre>
			</div>
		</details>
	);
}
