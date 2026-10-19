import { Option } from "effect";
import { CircleAlert, Lock } from "lucide-react";
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
	const server = typeof window === "undefined";
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
				<pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{source.context}</pre>
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
				onInput={state.edit}
				onSubmit={(event) => {
					event.preventDefault();
					if (data.writable && state.preview && state.valid && !state.created.saving) {
						state.created.save();
					}
				}}
			>
				<FormField form={state.form} label="Agent name" maxLength={200} name="recipient" required />
				<FormField form={state.form} label="Goal" maxLength={8192} name="goal" required rows={3} />
				<FormField form={state.form} label="Constraints (optional)" maxLength={8192} name="constraints" rows={4} />
				<FormField form={state.form} label="Next step" maxLength={8192} name="nextAction" required rows={3} />
				<div className="flex flex-wrap gap-2">
					<Button disabled={server || state.created.saving} id={shellIds.handoffPreview} onClick={state.showPreview} type="button" variant="outline">
						Preview file
					</Button>
					{data.writable && (
						<Button disabled={!(state.preview && state.valid) || state.created.saving} id={shellIds.handoffSubmit} type="submit">
							Prepare handoff
						</Button>
					)}
					<Button disabled={server || state.created.saving} id={shellIds.handoffClear} onClick={state.clear} type="button" variant="ghost">
						Clear draft
					</Button>
				</div>
				<pre
					className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs"
					hidden={!state.preview}
					id={shellIds.handoffPreviewContent}
				>
					{state.preview}
				</pre>
				<p className="m-0 text-muted-foreground" id={shellIds.handoffStatus} role="status">
					{server ? "Turn on JavaScript to prepare a handoff." : state.status}
				</p>
				<section hidden={!saved} id={shellIds.handoffPrepared}>
					{saved && <HandoffPrompt id={saved.id} prepared prompt={saved.prompt} />}
				</section>
			</form>
		</SectionCard>
	);
}
