import { useAtomRef } from "@effect/atom-react";
import { Equal, Option } from "effect";
import { useEffect, useMemo, useState } from "react";
import { useCreate } from "@shivaedev/react/client/create.ts";
import { chosenLabels } from "#browser/responses/cardContext.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { PromptAnswer, QuestionPreview } from "#browser/responses/schema.ts";
import { formDraft } from "#client/formDraft.ts";
import { type DraftInteraction, formStatus, responseSaved } from "#client/formStatus.ts";
import { answerRecovery, recoveryText } from "#client/responses/answerRecovery.ts";
import { draftText } from "#client/responses/draftText.ts";
import { type ResponseInput, responseFormSchema } from "#client/responses/formSchema.ts";
import { initialResponse } from "#client/responses/initial.ts";
import { responsePreview } from "#client/responses/preview.ts";
import { retainContext } from "#client/responses/retainContext.ts";
import { responseFeedback, responseSummary } from "#client/responses/summary.ts";
import { sourceChanged } from "#client/sourceChanged.ts";
import type { Metadata } from "#metadata/schema.ts";
import { createResponse } from "./createResponse.ts";
import { useFormClient } from "./FormContext.ts";
import { responseAnswers } from "./responseAnswers.ts";
import { useResponseAuthor } from "./useResponseAuthor.ts";
import { useValidation } from "./useValidation.ts";

export function useResponseForm(source: QuestionPreview, prompts: readonly Prompt[], options?: Metadata["options"], supersedes?: string) {
	const client = useFormClient();
	const hasPrompts = prompts.length > 0;
	const requiredSelections = prompts
		.filter((prompt) => prompt.requireSelection)
		.map((prompt) => prompt.id)
		.join("\n");
	const schema = useMemo(() => responseFormSchema(hasPrompts, requiredSelections.split("\n")), [hasPrompts, requiredSelections]);
	const [preview, setPreview] = useState<ResponseInput>();
	const [interaction, setInteraction] = useState<DraftInteraction>("draft");
	const [attempted, setAttempted] = useState(false);
	const readAuthor = useResponseAuthor();
	const [initial] = useState(() => initialResponse(prompts, readAuthor(), supersedes));
	const draft = formDraft(client.now, "response", source.item, source.request);
	const created = useCreate({
		create: (submission) => createResponse(client, source, submission),
		fields: schema,
		initialValues: initial,
		persistedDraft: draft,
		rejectField: () => undefined,
		runtime: client.runtime,
	});
	const form = created.form;
	const validate = useValidation(form.validate);
	const values = useAtomRef(form.values);
	useEffect(() => {
		if (Option.isSome(created.created)) {
			form.receive({ ...initial, author: readAuthor() });
			if (created.dirty) {
				retainContext(form, created.created.value);
			}
		}
	}, [form, created.created, created.dirty, initial, readAuthor]);
	const same = values.question === source.id && values.revision === source.reviewedRevision;
	const stale = Boolean(values.id) && !same;
	const recovery = answerRecovery(values, !stale || values.answerContext === JSON.stringify([source.id, source.reviewedRevision]));
	useEffect(() => {
		if (!Equal.equals(values.recovery, recovery)) {
			form.change("recovery", recovery);
		}
	}, [form, values.recovery, recovery]);
	function answers(snapshot = form.values.value) {
		return responseAnswers(snapshot, source, prompts);
	}
	function editAnswers(index: number, next: PromptAnswer) {
		form.change(
			"answers",
			answers()?.map((answer, position) => (position === index ? next : answer)),
		);
		form.change("answerContext", JSON.stringify([source.id, source.reviewedRevision]));
		edit();
	}
	function showPreview(onValid?: () => void, onInvalid?: () => void) {
		setAttempted(true);
		setInteraction("draft");
		if (!form.values.value.id || form.values.value.question !== source.id || form.values.value.revision !== source.reviewedRevision) {
			form.change("id", `response.${crypto.randomUUID()}`);
		}
		form.change("answers", answers());
		form.change("answerContext", JSON.stringify([source.id, source.reviewedRevision]));
		form.change("question", source.id);
		form.change("revision", source.reviewedRevision);
		validate((snapshot) => {
			setPreview(snapshot?.encoded);
			if (snapshot) {
				onValid?.();
			} else {
				onInvalid?.();
			}
		});
	}
	function edit() {
		if (!form.values.value.id) {
			form.change("id", `response.${crypto.randomUUID()}`);
			form.change("question", source.id);
			form.change("revision", source.reviewedRevision);
		}
		setPreview(undefined);
		if (!created.saving) {
			setInteraction("draft");
		}
	}
	function clear() {
		setAttempted(false);
		created.revert();
		setPreview(undefined);
		setInteraction("cleared");
	}
	const previewed = preview !== undefined && same && Equal.equals(preview, values);
	const { outcome, text: status } = formStatus(created, interaction, "response", (saved) =>
		responseSaved(saved.id, created.dirty, chosenLabels(prompts, saved.answers, options)),
	);
	const summary = responseSummary(values, prompts, answers(values), attempted);
	return {
		answers: answers(values),
		attempt: (onValid: () => void, onInvalid?: () => void, author = readAuthor()) => {
			form.change("author", author);
			showPreview(onValid, onInvalid);
		},
		attempted,
		author: readAuthor(),
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
		editAnswers,
		form,
		outcome,
		preview: previewed ? responsePreview(values, source.id, prompts) : undefined,
		recovery: recoveryText(recovery),
		showPreview: () => showPreview(),
		status: [stale ? sourceChanged() : "", responseFeedback(status, outcome, summary)].filter(Boolean).join(" "),
		text: draftText(prompts, answers(values), values.body, options),
	};
}
