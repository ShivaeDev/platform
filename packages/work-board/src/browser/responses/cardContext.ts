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

export function optionLabel(id: string, source: string, reason: string) {
	const heading = /^#{1,6}\s+(?<title>.+)$/mu.exec(source)?.groups?.title;
	if (heading) {
		return heading;
	}
	if (id === "retry" && /reviewed pr is ready to merge/iu.test(reason)) {
		return "Request changes (retry)";
	}
	return id.charAt(0).toUpperCase() + id.slice(1).replaceAll("-", " ");
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
