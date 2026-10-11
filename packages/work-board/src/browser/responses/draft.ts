import { authorLabel } from "./authorLabel.ts";
import { draftSession } from "./draftSession.ts";

export function responseDraft(form: HTMLFormElement, report: (message: string) => void) {
	const workspace = document.documentElement.dataset.workspace;
	let storage: Storage | undefined;
	try {
		storage = window.localStorage;
	} catch {
		storage = undefined;
	}
	const drafts = draftSession(
		`${form.dataset.item ?? ""}/${form.dataset.request ?? ""}`,
		form.dataset.revision ?? "",
		storage,
		`work-board:drafts:${workspace}`,
		report,
	);
	return { drafts, label: authorLabel(storage, workspace) };
}
