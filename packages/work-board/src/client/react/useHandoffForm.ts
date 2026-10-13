import { useAtomRef } from "@effect/atom-react";
import { Effect, Equal, Layer, Option, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect, useRef, useState } from "react";
import { useCreate } from "@shivaedev/effect-react/create.ts";
import { HandoffInput, type HandoffPreview } from "#browser/handoffs/schema.ts";
import type { HandoffProjection } from "#browser/views/remaining.ts";
import { session } from "#client/entry.ts";
import { formDraft } from "#client/formDraft.ts";
import { failureStatus } from "#client/handoffs/failureStatus.ts";
import { sourceChanged } from "#client/sourceChanged.ts";

const runtime = Atom.runtime(Layer.empty);
export function useHandoffForm(data: HandoffProjection, source: HandoffPreview) {
	const [preview, setPreview] = useState<HandoffInput>();
	const [status, setStatus] = useState("Draft ready. Review and preview before preparing the file.");
	const modelRef = useRef<HandoffInput | undefined>(undefined);
	const draft = formDraft("handoff", source.item);
	const created = useCreate({
		create: (input) =>
			Effect.tryPromise({
				catch: (error) => error,
				try: async () => {
					const native = session(window);
					setStatus("Pending: preparing the local handoff file…");
					try {
						const saved = await native.mutate(native.handoffs.prepareHandoff.run(input));
						const newer = !Equal.equals(modelRef.current, input);
						setStatus(
							`Prepared: ${saved.file}. Receipt: ${saved.handoff.state}; execution and acceptance remain separate.${newer ? " Your newer draft remains unsaved." : ""}`,
						);
						return saved;
					} catch (error) {
						setStatus(failureStatus(error));
						throw error;
					}
				},
			}),
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
		runtime,
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
	modelRef.current = values;
	const stale = Boolean(values.id) && (values.revision !== source.reviewedRevision || values.source !== source.source);
	function edit() {
		if (!form.values.value.id) {
			form.change("id", `handoff.${crypto.randomUUID()}`);
			form.change("revision", source.reviewedRevision);
		}
		setPreview(undefined);
		if (!created.saving) {
			setStatus("Draft ready. Review and preview before preparing the file.");
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
		setStatus("Draft cleared. Saved handoffs are unchanged.");
	}
	const previewed = preview !== undefined && !stale && Equal.equals(preview, values);
	return {
		clear,
		created,
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
