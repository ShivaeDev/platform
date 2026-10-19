import { useAtomRef } from "@effect/atom-react";
import { Equal, Option, Schema } from "effect";
import { useEffect, useState } from "react";
import { useCreate } from "@shivaedev/effect-react/client/create.ts";
import { HandoffInput, type HandoffPreview } from "#browser/handoffs/schema.ts";
import type { HandoffProjection } from "#browser/views/remaining.ts";
import { closedStatus } from "#browser/views/workStatus.ts";
import { formDraft } from "#client/formDraft.ts";
import { type DraftInteraction, formStatus } from "#client/formStatus.ts";
import { useFormClient } from "./FormContext.ts";

const fields = ["constraints", "goal", "id", "item", "nextAction", "recipient", "revision", "source"] as const;

export function useHandoffForm(data: HandoffProjection, source: HandoffPreview) {
	const client = useFormClient();
	const [preview, setPreview] = useState<HandoffInput>();
	const [interaction, setInteraction] = useState<DraftInteraction>("draft");
	const [notice, setNotice] = useState<string>();
	const [initial] = useState(() => ({
		constraints: "",
		goal: data.goal,
		id: "",
		item: source.item,
		nextAction: closedStatus(data.status) ? "" : data.nextAction,
		recipient: data.owner ?? "",
		revision: "",
		source: source.source,
	}));
	const draft = formDraft("handoff", source.item);
	const created = useCreate({
		create: client.handoffs.prepareHandoff.run,
		fields: HandoffInput,
		initialValues: initial,
		persistedDraft: draft,
		rejectField: () => undefined,
		runtime: client.runtime,
	});
	const form = created.form;
	const values = useAtomRef(form.values);
	useEffect(() => {
		if (Option.isSome(created.created)) {
			form.receive({ ...initial, recipient: created.created.value.handoff.recipient });
		}
	}, [form, created.created, initial]);
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
		setNotice(undefined);
		if (!created.saving) {
			setInteraction("draft");
		}
	}
	function bind() {
		if (!form.values.value.id || stale) {
			form.change("id", `handoff.${crypto.randomUUID()}`);
		}
		form.change("revision", source.reviewedRevision);
		form.change("source", source.source);
		for (const name of fields) {
			form.blur(name);
		}
	}
	function showPreview() {
		bind();
		setPreview(form.values.value);
	}
	function prepare() {
		// A draft written against an older source is rebound first, so the reader sees the change before anything is saved.
		const changed = stale;
		bind();
		if (changed) {
			setNotice("Updated to the item's new version. Check your text still fits, then prepare the handoff again.");
			return;
		}
		if (!Schema.is(HandoffInput)(form.values.value)) {
			setInteraction("draft");
			setNotice("Fill in the marked fields, then prepare the handoff.");
			return;
		}
		setNotice(undefined);
		setInteraction("submitted");
		created.save();
	}
	function clear() {
		created.revert();
		setPreview(undefined);
		setNotice(undefined);
		setInteraction("cleared");
	}
	const previewed = preview !== undefined && !stale && Equal.equals(preview, values);
	const { text: status } = formStatus(
		created,
		interaction,
		"handoff",
		(saved) => `Saved ${saved.file}. Copy the prompt below into your agent session.${created.dirty ? " Your newer draft remains unsaved." : ""}`,
	);
	const shown = stale
		? "Source changed since this draft. Your text is kept. Read the new version above, then prepare the handoff."
		: (notice ?? status);
	return {
		clear,
		created,
		draft,
		edit,
		form,
		prepare,
		preview: previewed ? handoffPreview(values) : undefined,
		showPreview,
		status: shown,
	};
}
function handoffPreview(input: HandoffInput) {
	return `New file: handoffs/${input.id}.md\nPrepared time and reviewed snapshot are assigned by the server.\n\n---\n${JSON.stringify({ handoff: { constraints: input.constraints, goal: input.goal, item: input.item, "next_action": input.nextAction, recipient: input.recipient, "reviewed_revision": input.revision, source: input.source, state: "requested" }, id: input.id, kind: "handoff" }, null, 2)}\n---\nThe complete reviewed source is preserved below the frontmatter.`;
}
