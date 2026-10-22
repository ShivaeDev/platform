export function indexedQuestion(id: string) {
	return `---\nid: ${id}\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\n---\n# ${id}`;
}
