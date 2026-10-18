import { Option } from "effect";
import type { HandoffPreview } from "#browser/handoffs/schema.ts";
import type { HandoffProjection } from "#browser/views/remaining.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { FormField } from "./FormField.tsx";
import { HandoffPrompt } from "./HandoffPrompt.tsx";
import { shellIds } from "./shellIds.ts";
import { useFormFocus } from "./useFormFocus.ts";
import { useHandoffForm } from "./useHandoffForm.ts";
export function HandoffForm({ data }: { readonly data: HandoffProjection }) {
	const source = data.source;
	if (!source) {
		return <p role="status">Source unavailable: {data.unavailable}. Existing handoffs remain readable.</p>;
	}
	return <HandoffSession data={data} key={source.item} source={source} />;
}
function HandoffSession({ data, source }: { readonly data: HandoffProjection; readonly source: HandoffPreview }) {
	const state = useHandoffForm(data, source);
	const focus = useFormFocus(state.draft.key);
	const saved = Option.getOrUndefined(state.created.created);
	const writableStatus = typeof window === "undefined" ? "JavaScript is required to prepare a handoff." : state.status;
	return (
		<>
			<details>
				<summary>Exact source being reviewed</summary>
				<pre>{source.context}</pre>
			</details>
			<form
				className="space-y-4 [&_button]:mr-2 [&_button]:mb-2"
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
				<FormField form={state.form} label="Recipient — local agent label" maxLength={200} name="recipient" required />
				<FormField form={state.form} label="Goal" maxLength={8192} name="goal" required rows={3} />
				<FormField form={state.form} label="Constraints (optional)" maxLength={8192} name="constraints" rows={4} />
				<FormField form={state.form} label="Next action" maxLength={8192} name="nextAction" required rows={3} />
				<p>
					The file includes the full reviewed source and its declared acceptance criteria. Preparing it does not change the item or start an agent.
					Drafts stay in this browser for seven days after the last edit, with a 256 KiB limit per draft.
				</p>
				<Button
					disabled={typeof window === "undefined" || state.created.saving}
					id={shellIds.handoffPreview}
					onClick={state.showPreview}
					type="button"
				>
					Preview Markdown
				</Button>
				<pre hidden={!state.preview} id={shellIds.handoffPreviewContent}>
					{state.preview}
				</pre>
				<Button disabled={!(data.writable && state.preview && state.valid) || state.created.saving} id={shellIds.handoffSubmit} type="submit">
					Prepare handoff
				</Button>
				<Button disabled={typeof window === "undefined" || state.created.saving} id={shellIds.handoffClear} onClick={state.clear} type="button">
					Clear draft
				</Button>
				<p id={shellIds.handoffStatus} role="status">
					{data.writable ? writableStatus : `${state.status} Read-only mode. Restart with --responses to enable local writes.`}
				</p>
				<section hidden={!saved} id={shellIds.handoffPrepared}>
					{saved && <HandoffPrompt id={saved.id} prepared prompt={saved.prompt} />}
				</section>
			</form>
		</>
	);
}
