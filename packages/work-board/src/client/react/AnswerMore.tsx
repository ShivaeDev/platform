import type { ReactNode } from "react";
import type { DocumentRequest } from "#browser/document/schema.ts";
import { Button } from "#client/react/components/ui/Button.tsx";
import { FormField } from "./FormField.tsx";
import { shellIds } from "./shellIds.ts";
import type { useResponseForm } from "./useResponseForm.ts";

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
				<FormField form={state.form} label="Response kind" name="type">
					<option value="answer">Answer (including no)</option>
					<option value="clarify">Ask back / clarify</option>
					<option value="not_now">Not now</option>
				</FormField>
				{body}
				<FormField form={state.form} label="Supersedes an earlier response (optional)" name="supersedes">
					<option value="">Adds feedback; does not supersede</option>
					{request.responses?.map((record) => (
						<option key={record.id} value={record.id}>
							{record.id} · {record.response.author} · {record.response.reviewedRevision.slice(0, 12)}
						</option>
					))}
				</FormField>
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
						variant="outline"
					>
						Preview Markdown
					</Button>
					<Button
						disabled={typeof window === "undefined" || state.created.saving}
						id={id(shellIds.responseClear)}
						onClick={state.clear}
						size="sm"
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
