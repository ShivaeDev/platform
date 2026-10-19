export function indexRevisions() {
	let seed = 517;
	function random(limit: number) {
		seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
		return Math.floor(seed / 65_536) % limit;
	}
	function source(step: number) {
		const id = random(8);
		const target = random(8);
		return `---\nid: item.${id}\nkind: task\nstatus: planned\nowner: agent\ncriteria:\n - id: done\n   text: Revision ${step}\nrelationships:\n - kind: depends_on\n   target: item.${target}#done\nattention:\n - id: review\n   kind: review\n   state: open\n   response_from: [maintainer]\n   reason: Review ${step}\n   unblocks: [item.${target}#done]\nevidence:\n - source: file-${random(8)}.md\n   criterion: item.${target}#done\n---\n# Revision ${step}\n\nRead [a source](file-${random(8)}.md).\n`;
	}
	const files = new Set(Array.from({ length: 8 }, (_, i) => `file-${i}.md`));

	const initialFiles = {
		...Object.fromEntries([...files].map((file, i) => [file, source(i)])),
		"board.md": "---\nid: board\nkind: board\nitems: [item.0, item.1, item.2, missing]\n---\n# Board",
	};
	return { files, initialFiles, random, source };
}
