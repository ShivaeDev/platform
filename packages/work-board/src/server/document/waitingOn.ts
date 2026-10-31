import { itemAsks, waitsOnYou } from "#browser/document/asks.ts";
import type { WaitingAsk } from "#browser/document/schema.ts";
import type { MetadataDocument } from "#integration/metadata.ts";
import { responseUrl } from "#responses/url.ts";
import { backlinksOf } from "#server/metadata/backlinks.ts";
import { identityUrl } from "#server/metadata/links.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { itemRequests } from "./requests.ts";

function pointsAt(source: MetadataDocument, request: string, item: string) {
	const { fields } = source.parsed;
	const attention = fields.attention?.find((entry) => entry.id === request);
	if (attention) {
		return attention.unblocks.some((target) => target.split("#")[0] === item);
	}
	return fields.relationships?.some((link) => link.target.split("#")[0] === item) === true;
}

function askTitle(title: string | undefined, source: MetadataDocument, request: string) {
	return title && !/[a-f\d]{64}/iu.test(title)
		? title
		: (source.parsed.fields.attention?.find((entry) => entry.id === request)?.reason ?? "Requested decision");
}

// Open asks in other files that name this item, through an attention request it unblocks or a relationship, so its page leads with them.
export function waitingOn(document: MetadataDocument, snapshot: Snapshot): readonly WaitingAsk[] {
	const item = document.parsed.fields.id;
	if (!item || snapshot.unavailable.length > 0) {
		return [];
	}
	const files = new Set(backlinksOf(document.file, snapshot.model).map((link) => link.file));
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	const asks = snapshot.model.documents.flatMap((source) => {
		const id = source.parsed.fields.id;
		if (!(id && files.has(source.file)) || source.file === document.file) {
			return [];
		}
		const metadata = source.parsed.fields;
		const requests = itemRequests(source, snapshot).flatMap((request) => (request.document === source ? [request.state] : []));
		return itemAsks({ metadata, requests })
			.filter((request) => pointsAt(source, request.id, item))
			.map((request) => ({
				answer: responseUrl(id, request.id),
				audience: waitsOnYou({ metadata, requests: [request] }) ? ("you" as const) : ("agents" as const),
				href: identityUrl(id),
				title: askTitle(titles.get(source.file), source, request.id),
			}));
	});
	return asks.toSorted((left, right) => Number(left.audience === "agents") - Number(right.audience === "agents"));
}
