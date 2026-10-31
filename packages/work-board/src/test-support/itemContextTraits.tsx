import { QueryDocument } from "./QueryDocument.tsx";
import { boardScreen } from "./screenTraits.ts";

export function itemOpened(files: Readonly<Record<string, string>>, path: string) {
	return boardScreen(files, (api) => <QueryDocument api={api} url={path} />);
}

export function informingReport(id: string, status: string, title: string) {
	return `---\nid: ${id}\nstatus: ${status}\nrelationships:\n  - kind: informs\n    target: task.fixture\n---\n# ${title}`;
}
