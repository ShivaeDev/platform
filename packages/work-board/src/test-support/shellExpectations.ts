export function notFoundNotice(url: string) {
	return {
		description: `Nothing on the Board lives at ${url}. The link may be old or mistyped.`,
		links: [
			["Back to Today", "/"],
			["Browse the Library", "/_board/library"],
		],
		retry: "not offered",
		title: "Page not found",
	};
}

export function pageButton(name: string) {
	return { name, opens: "in place", role: "button" };
}

export function pageLink(name: string, opens: string) {
	return { name, opens, role: "link" };
}

export function phoneTabList(current?: string) {
	return [
		["Today, 7 need you", "/"],
		["Goals", "/_board/goals"],
		["Now", "/_board/work"],
	].map(([name = "", href = ""]) => ({ current: href === current, href, name }));
}

export function noteLinks(...titles: string[]) {
	return titles.map((title) => ({ href: `/notes/${title.toLowerCase()}.md`, title }));
}

export function topicLinks(...numbers: number[]) {
	return numbers.map((number) => ({ href: `/notes/topic-${number}.md`, title: `Topic ${number}` }));
}

export function fileLinks(entries: ReadonlyArray<{ readonly file: string; readonly title: string }>) {
	return entries.map(({ file, title }) => ({ href: `/${file}`, title }));
}

export function readStamp(at: number) {
	return `read ${new Date(at).toISOString()}`;
}
