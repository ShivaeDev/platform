export function indexedQuestion(id: string) {
	return `---\nid: ${id}\nkind: question\nstatus: open\n---\n# ${id}`;
}
