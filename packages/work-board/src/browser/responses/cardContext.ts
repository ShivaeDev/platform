import { reasonMarkdown } from "./reasonMarkdown.ts";

export function cardContext(source: string) {
	const recommendation = reasonMarkdown(section(source, "Recommendation"));
	const relevant = section(source, "Relevant links");
	const links = [...relevant.matchAll(/https?:\/\/[^\s<>()[\]]+/gu)].map(([url]) => {
		const pr = /\/pull\/(?<number>\d+)/u.exec(url)?.groups?.number;
		return { label: pr ? `Open PR #${pr}` : "Open relevant link", primary: Boolean(pr), url };
	});
	return { links, recommendation };
}

export function optionText(id: string, source: string, reason: string) {
	const heading = promptHeading(source);
	if (heading.title) {
		return { description: heading.rest, label: heading.title };
	}
	const lead = /^\*\*(?<label>[^*]+)\*\*\s*(?:[—–:-]\s*)?/u.exec(source.trim());
	if (lead?.groups?.label) {
		return { description: source.trim().slice(lead[0].length).trim(), label: lead.groups.label.trim() };
	}
	if (id === "retry" && /reviewed pr is ready to merge/iu.test(reason)) {
		return { description: source.trim(), label: "Request changes (retry)" };
	}
	return { description: source.trim(), label: id.charAt(0).toUpperCase() + id.slice(1).replaceAll("-", " ") };
}

function section(source: string, title: string) {
	const lines = source.split("\n");
	let active = false;
	let fence: string | undefined;
	const content: string[] = [];
	for (const line of lines) {
		const marker = /^\s*(?<fence>`{3,}|~{3,})/u.exec(line)?.groups?.fence;
		if (!fence && (/^##\s/u.test(line) || line.startsWith("::::question"))) {
			if (active) {
				break;
			}
			active = line.trim() === `## ${title}`;
			continue;
		}
		if (active) {
			content.push(line);
		}
		if (marker) {
			fence = nextFence(fence, marker);
		}
	}
	return content.join("\n").trim();
}

function nextFence(current: string | undefined, marker: string) {
	return current?.startsWith(marker.charAt(0)) && marker.length >= current.length ? undefined : marker;
}

export function promptHeading(source: string) {
	const heading = /^#{1,6}\s+(?<title>.+)$/mu.exec(source);
	return { rest: heading ? source.replace(heading[0], "").trim() : source.trim(), title: heading?.groups?.title?.trim() };
}
