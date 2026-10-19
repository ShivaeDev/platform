import { RegistryContext } from "@effect/atom-react";
import { Cause, Effect, Option } from "effect";
import { useContext, useMemo, useRef, useState } from "react";
import { useAction } from "@shivaedev/effect-react/client/resultState.ts";
import type { Document } from "#browser/document/schema.ts";
import { answerBody } from "#browser/responses/answerBody.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { authorLabel } from "#client/responses/authorLabel.ts";
import { saveFailure } from "#client/saveFailure.ts";
import { fileUrl } from "#files/url.ts";
import { createResponse } from "./createResponse.ts";
import { useFormClient } from "./FormContext.ts";
import { documentQuery, navigationQuery, routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";

export interface TodayChoice {
	readonly selected: readonly string[];
	readonly text: string;
}

export function useTodayAnswer(api: ShellApi, data: Document, preview: QuestionPreview, prompts: readonly Prompt[]) {
	const registry = useContext(RegistryContext);
	const questionRef = useRef({ preview, prompts });
	questionRef.current = { preview, prompts };
	const client = useFormClient();
	const [label] = useState(() => authorLabel(() => localStorage, document.documentElement.dataset.workspace));
	const [author, setAuthor] = useState(() => label.read("") || "maintainer");
	const actionAtom = useMemo(
		() =>
			client.runtime.fn(
				Effect.fn("Board.answerToday")(function* (choice: TodayChoice) {
					const { preview: asked, prompts: shown } = questionRef.current;
					const answers = shown.map((prompt) => ({ prompt: prompt.id, selected: [...choice.selected], text: choice.text }));
					const saved = yield* createResponse(client, asked, {
						...(answers.length > 0 ? { answers, body: answerBody(shown, answers, "") } : { body: choice.text }),
						author: author.trim(),
						id: `response.${crypto.randomUUID()}`,
						question: asked.id,
						revision: asked.reviewedRevision,
						type: "answer",
					});
					label.save(author);
					registry.refresh(api.inbox.query(undefined, routeQueryOptions));
					registry.refresh(navigationQuery(api));
					registry.refresh(documentQuery(api, fileUrl(data.file)));
					return saved;
				}),
			),
		[client, api, registry, author, data.file, label.save],
	);
	const action = useAction(actionAtom);
	const failure = Option.getOrUndefined(Option.flatMap(action.cause, Cause.findErrorOption));
	let status = failure ? saveFailure(failure, "response").text : "";
	if (action.pending) {
		status = "Pending: registering reviewed context, then recording response…";
	}
	return { author, choose: action.dispatch, locked: !author.trim() || action.pending || Option.isSome(action.data), setAuthor, status };
}
