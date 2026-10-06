import { fileUrl } from "#files/url.ts";
import { attachmentHref } from "#path/attachment.ts";
import { referenceTarget } from "./links.ts";
import type { MetadataModel } from "./model.ts";

const BASE = "http://work-board.local";
const absolute = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu;

export function sourceHref(source: string, file: string): string | undefined {
	try {
		const url = new URL(source, `${BASE}${fileUrl(file)}`);
		if (!["http:", "https:"].includes(url.protocol)) {
			return undefined;
		}
		const local = url.pathname + url.search + url.hash;
		return absolute.exec(source) === null ? (attachmentHref(local) ?? local) : url.href;
	} catch {
		return undefined;
	}
}

export function referenceFile(reference: string, model: MetadataModel): string | undefined {
	if (!referenceTarget(reference, model)) {
		return undefined;
	}
	return model.ids.get(reference.split("#")[0] ?? "")?.[0]?.file;
}

export function sourceFile(source: string, file: string, model: MetadataModel): string | undefined {
	const href = sourceHref(source, file);
	if (!href?.startsWith("/")) {
		return undefined;
	}
	const url = new URL(href, BASE);
	try {
		const path = decodeURIComponent(url.pathname);
		if (path === "/") {
			return model.rootFile;
		}
		const identity = /^\/_board\/item\/(?<id>[^/]+)\/$/u.exec(path)?.groups?.id;
		if (identity) {
			return referenceFile(identity, model);
		}
		return /\.md$/iu.exec(path) === null ? undefined : path.slice(1);
	} catch {
		return undefined;
	}
}
