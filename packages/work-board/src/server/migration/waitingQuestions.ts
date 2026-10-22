import { sourceHeader } from "./sourceHeader.ts";

interface File {
	readonly file: string;
	readonly source: string;
}
function waitingWork(files: readonly File[]) {
	const waiting = new Set<string>();
	for (const { file, source } of files) {
		if (!file.endsWith("fleet/status.md")) {
			continue;
		}
		for (const card of source.matchAll(/^### (?<work>[^\n]+)\n(?<body>[\s\S]*?)(?=^### |^## |$(?![\s\S]))/gmu)) {
			if (/Stage: (?:needs-human|waiting)/u.test(card.groups?.body ?? "")) {
				waiting.add((card.groups?.work ?? "").replaceAll(/\\(?<escaped>.)/gu, "$<escaped>"));
			}
		}
	}
	return waiting;
}
export function waitingQuestions(files: readonly File[]) {
	const waiting = waitingWork(files);
	const documents = files.flatMap(({ source }) => {
		const header = sourceHeader(source);
		return header ? [header.doc.toJS()] : [];
	});
	const blocking = new Set<string>();
	for (const data of documents) {
		const targets = [
			...(data.relationships ?? []).map((link: { target: string }) => link.target),
			...(data.attention ?? []).flatMap((request: { unblocks?: string[] }) => request.unblocks ?? []),
		];
		if (targets.some((target) => waiting.has(target.split("#")[0] ?? "")) && typeof data.id === "string") {
			blocking.add(data.id);
		}
	}
	for (const data of documents) {
		if (data.question && blocking.has(data.question.item) && typeof data.id === "string") {
			blocking.add(data.id);
		}
	}
	return blocking;
}
