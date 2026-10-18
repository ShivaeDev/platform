import { metadataParse } from "#server/metadata/parse.ts";

export const REVIEWED_WORK_HEADING = "## Reviewed Board work";

export function reviewedWork(source: string): string | undefined {
	const parsed = metadataParse(source);
	if (parsed.raw === undefined || parsed.diagnostics.length > 0) {
		return undefined;
	}
	const heading = /^\s*#[ \t]+(?<title>.+?)[ \t]*(?:\r?\n|$)/u.exec(parsed.body);
	const title = heading?.groups?.title ?? parsed.fields.id;
	const body = parsed.body.slice(heading?.[0].length ?? 0).trim();
	const criteria = parsed.fields.criteria ?? [];
	return [
		[title && `**${title}**`, parsed.fields.id && `\`${parsed.fields.id}\``].filter(Boolean).join(" · "),
		criteria.length > 0 ? `Criteria:\n\n${criteria.map((criterion) => `- ${criterion.text}`).join("\n")}` : "",
		body
			.split("\n")
			.map((line) => (line.trim() ? `> ${line}` : ">"))
			.join("\n"),
	]
		.filter((block) => block.length > 0 && block !== ">")
		.join("\n\n");
}
