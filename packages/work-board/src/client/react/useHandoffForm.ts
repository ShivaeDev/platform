import { useAtomRef } from "@effect/atom-react";
import { Equal, Option, Schema } from "effect";
import { useEffect, useState } from "react";
import { useCreate } from "@shivaedev/effect-react/client/create.ts";
import { HandoffInput, type HandoffPreview } from "#browser/handoffs/schema.ts";
import type { HandoffProjection } from "#browser/views/remaining.ts";
import { formDraft } from "#client/formDraft.ts";
import { type DraftInteraction, formStatus } from "#client/formStatus.ts";
import { sourceChanged } from "#client/sourceChanged.ts";
import { useFormClient } from "./FormContext.ts";
export function useHandoffForm(data: HandoffProjection, source: HandoffPreview) {
	const client = useFormClient();
	const [preview, setPreview] = useState<HandoffInput>();
	const [interaction, setInteraction] = useState<DraftInteraction>("draft");
	const draft = formDraft("handoff", source.item);
	const created = useCreate({
		create: client.handoffs.prepareHandoff.run,
		fields: HandoffInput,
		initialValues: {
			constraints: "",
			goal: data.goal,
			id: "",
			item: source.item,
			nextAction: data.nextAction,
			recipient: "",
			revision: "",
			source: source.source,
		},
		persistedDraft: draft,
		rejectField: () => undefined,
		runtime: client.runtime,
	});
	const form = created.form;
	const values = useAtomRef(form.values);
	useEffect(() => {
		if (created.dirty && Option.isSome(created.created) && !form.values.value.id) {
			form.change("id", `handoff.${crypto.randomUUID()}`);
			form.change("revision", created.created.value.handoff.reviewedRevision);
			form.change("source", created.created.value.handoff.source);
		}
	}, [form, created.dirty, created.created]);
	const stale = Boolean(values.id) && (values.revision !== source.reviewedRevision || values.source !== source.source);
	function edit() {
		if (!form.values.value.id) {
			form.change("id", `handoff.${crypto.randomUUID()}`);
			form.change("revision", source.reviewedRevision);
		}
		setPreview(undefined);
		if (!created.saving) {
			setInteraction("draft");
		}
	}
	function showPreview() {
		if (!values.id || stale) {
			form.change("id", `handoff.${crypto.randomUUID()}`);
		}
		form.change("revision", source.reviewedRevision);
		form.change("source", source.source);
		for (const name of ["constraints", "goal", "id", "item", "nextAction", "recipient", "revision", "source"] as const) {
			form.blur(name);
		}
		setPreview(form.values.value);
	}
	function clear() {
		created.revert();
		setPreview(undefined);
		setInteraction("cleared");
	}
	const previewed = preview !== undefined && !stale && Equal.equals(preview, values);
	const { text: status } = formStatus(
		created,
		interaction,
		"handoff",
		(saved) =>
			`Prepared: ${saved.file}. Receipt: ${saved.handoff.state}; execution and acceptance remain separate.${created.dirty ? " Your newer draft remains unsaved." : ""}`,
	);
	return {
		clear,
		created: {
			...created,
			save: () => {
				setInteraction("submitted");
				created.save();
			},
		},
		draft,
		edit,
		form,
		preview: previewed ? handoffPreview(values) : undefined,
		showPreview,
		status: stale ? sourceChanged() : status,
		valid: Schema.is(HandoffInput)(values),
	};
}
function handoffPreview(input: HandoffInput) {
	return `New file: handoffs/${input.id}.md\nPrepared time and reviewed snapshot are assigned by the server.\n\n---\n${JSON.stringify({ handoff: { constraints: input.constraints, goal: input.goal, item: input.item, "next_action": input.nextAction, recipient: input.recipient, "reviewed_revision": input.revision, source: input.source, state: "requested" }, id: input.id, kind: "handoff" }, null, 2)}\n---\nThe complete reviewed source is preserved below the frontmatter.`;
}
