import type { HandoffProjection } from "#browser/views/remaining.ts";
import { shellIds } from "./shellIds.ts";
export function HandoffForm({ data }: { readonly data: HandoffProjection }) {
	const source = data.source;
	if (!source) {
		return <p role="status">Source unavailable: {data.unavailable}. Existing handoffs remain readable.</p>;
	}
	return (
		<>
			<details>
				<summary>Exact source being reviewed</summary>
				<pre>{source.context}</pre>
			</details>
			<form
				data-item={source.item}
				data-question={source.id}
				data-revision={source.reviewedRevision}
				data-source={source.source}
				data-writable={data.writable}
				id={shellIds.handoffForm}
			>
				<label>
					Recipient — local agent label
					<input maxLength={200} name="recipient" required />
				</label>
				<label>
					Goal
					<textarea defaultValue={data.goal} maxLength={8192} name="goal" required rows={3} />
				</label>
				<label>
					Constraints (optional)
					<textarea maxLength={8192} name="constraints" rows={4} />
				</label>
				<label>
					Next action
					<textarea defaultValue={data.nextAction} maxLength={8192} name="nextAction" required rows={3} />
				</label>
				<p>
					The file includes the full reviewed source and its declared acceptance criteria. Preparing it does not change the item or start an agent.
					Drafts stay in this browser for seven days after the last edit, with a 256 KiB limit per draft.
				</p>
				<button disabled id={shellIds.handoffPreview} type="button">
					Preview Markdown
				</button>
				<pre hidden id={shellIds.handoffPreviewContent} />
				<button disabled id={shellIds.handoffSubmit} type="submit">
					Prepare handoff
				</button>
				<button disabled id={shellIds.handoffClear} type="button">
					Clear draft
				</button>
				<p id={shellIds.handoffStatus} role="status">
					{data.writable ? "JavaScript is required to prepare a handoff." : "Read-only mode. Restart with --responses to enable local writes."}
				</p>
				<section hidden id={shellIds.handoffPrepared} />
			</form>
		</>
	);
}
