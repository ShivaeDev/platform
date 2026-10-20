export function reviewDocument(output: string) {
	const match = /^## TL;DR\s*\n(?<tldr>[\s\S]+?)\n## Details\s*\n(?<details>[\s\S]+)/u.exec(output.trim());
	const tldr = match?.groups?.tldr?.trim();
	const malformed = tldr === undefined || !/verdict:/iu.test(tldr) || (tldr.match(/^[-*] /gmu)?.length ?? 0) > 5;
	const note = "Malformed review: expected ## TL;DR (verdict and at most five findings) followed by ## Details.";
	return { output: malformed ? `${output}\n\n${note}` : output, tldr: malformed ? note : tldr };
}
