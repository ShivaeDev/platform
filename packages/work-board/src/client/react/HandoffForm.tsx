import { Option } from "effect";
import { CircleAlert, Lock } from "lucide-react";
import { useState } from "react";
import type { HandoffPreview } from "#browser/handoffs/schema.ts";
import type { HandoffProjection } from "#browser/views/remaining.ts";
import { Alert, AlertDescription, AlertTitle } from "#client/react/components/ui/alert.tsx";
import { Button } from "#client/react/components/ui/button.tsx";
import { FormField } from "./FormField.tsx";
import { HandoffPrompt } from "./HandoffPrompt.tsx";
import { SectionCard } from "./SectionCard.tsx";
import { shellIds } from "./shellIds.ts";
import { useFormFocus } from "./useFormFocus.ts";
import { useHandoffForm } from "./useHandoffForm.ts";

export function HandoffForm({ data }: { readonly data: HandoffProjection }) {
	const source = data.source;
	if (!source) {
		return (
			<Alert role="status">
				<CircleAlert aria-hidden="true" />
				<AlertTitle>Can't prepare a new handoff</AlertTitle>
				<AlertDescription>{data.unavailable} Earlier handoffs are still listed below.</AlertDescription>
			</Alert>
		);
	}
	return <HandoffSession data={data} key={source.item} source={source} />;
}

function HandoffSession({ data, source }: { readonly data: HandoffProjection; readonly source: HandoffPreview }) {
	const state = useHandoffForm(data, source);
	const focus = useFormFocus(state.draft.key);
	const saved = Option.getOrUndefined(state.created.created);
	const [copied, setCopied] = useState<{ readonly id: string; readonly text: string }>();
	const status = copied && copied.id === saved?.id && !state.created.saving ? copied.text : state.status;
	return (
		<SectionCard
			description="The file includes the item's full source and its checks. Preparing it doesn't change the item or start the agent. Your draft stays in this browser for 7 days."
			title="New handoff"
		>
			{!data.writable && (
				<Alert>
					<Lock aria-hidden="true" />
					<AlertTitle>Read-only</AlertTitle>
					<AlertDescription>Saving handoffs is turned off on this Board.</AlertDescription>
				</Alert>
			)}
			<details className="rounded-md border px-3 py-2">
				<summary className="cursor-pointer font-medium">Show the item's full source</summary>
				<pre className="bg-muted mt-2 max-h-96 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">{source.context}</pre>
			</details>
			<form
				className="space-y-4"
				{...focus}
				data-item={source.item}
				data-question={source.id}
				data-revision={source.reviewedRevision}
				data-source={source.source}
				data-writable={data.writable}
				id={shellIds.handoffForm}
				noValidate
				onInput={() => {
					setCopied(undefined);
					state.edit();
				}}
				onSubmit={(event) => {
					event.preventDefault();
					if (data.writable && !state.created.saving) {
						setCopied(undefined);
						state.prepare();
					}
				}}
			>
				<FormField form={state.form} label="Agent name" maxLength={200} name="recipient" required />
				<FormField form={state.form} label="Goal" maxLength={8192} name="goal" required rows={3} />
				<FormField form={state.form} label="Constraints (optional)" maxLength={8192} name="constraints" rows={4} />
				<FormField
					form={state.form}
					label="Next step"
					maxLength={8192}
					name="nextAction"
					placeholder="What should the agent do first?"
					required
					rows={3}
				/>
				<div className="flex flex-wrap gap-2">
					<Button disabled={!data.writable || state.created.saving} id={shellIds.handoffSubmit} type="submit" variant="secondary">
						Prepare handoff
					</Button>
					<Button disabled={state.created.saving} id={shellIds.handoffPreview} onClick={state.showPreview} type="button" variant="outline">
						Preview file
					</Button>
					<Button disabled={state.created.saving} id={shellIds.handoffClear} onClick={state.clear} type="button" variant="ghost">
						Clear draft
					</Button>
				</div>
				<pre
					className="bg-muted max-h-96 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap"
					hidden={!state.preview}
					id={shellIds.handoffPreviewContent}
				>
					{state.preview}
				</pre>
				<p className="text-muted-foreground" id={shellIds.handoffStatus} role="status">
					{status}
				</p>
				<section hidden={!saved} id={shellIds.handoffPrepared}>
					{saved !== undefined && (
						<HandoffPrompt id={saved.id} key={saved.id} onStatus={(text) => setCopied({ id: saved.id, text })} prompt={saved.prompt} />
					)}
				</section>
			</form>
		</SectionCard>
	);
}
