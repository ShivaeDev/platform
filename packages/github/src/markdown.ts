export function plainText(text: string): string {
	return text.replace(/[!-/:-@[-`{-~]/gu, (character) => {
		const separator = character === "@" || character === "#" ? "&#8203;" : "";
		return `&#${character.charCodeAt(0)};${separator}`;
	});
}

export function codeSpan(text: string): string {
	const content = text.replace(/\r\n|\r|\n/gu, " ");
	if (content === "") {
		return "";
	}
	let longest = 0;
	for (const [run] of content.matchAll(/`+/gu)) {
		longest = Math.max(longest, run.length);
	}
	const fence = "`".repeat(longest + 1);
	const pad = content.startsWith("`") || content.endsWith("`") || (/^ .* $/u.test(content) && /[^ ]/u.test(content)) ? " " : "";
	return `${fence}${pad}${content}${pad}${fence}`;
}

export function tableCell(text: string, format: "text" | "code" = "text"): string {
	const content = text.replace(/\r\n|[\r\n\u2028\u2029]/gu, " ");
	return format === "code" ? codeSpan(content.replaceAll("|", "\\|")) : plainText(content);
}
