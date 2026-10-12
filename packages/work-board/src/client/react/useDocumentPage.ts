import { useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { Document } from "#browser/document/schema.ts";
import { documentSourceId } from "#client/document/layout.ts";
import { fileUrl } from "#files/url.ts";
import type { MainLocation } from "./mainLocation.ts";
export function useDocumentPage({
	data,
	pending,
	status,
	onPage,
	url,
}: {
	readonly data: Document | undefined;
	readonly pending: boolean;
	readonly status: string;
	readonly url: string;
	readonly onPage: (location: MainLocation) => void;
}) {
	const hostRef = useRef<HTMLElement>(null);
	useLayoutEffect(() => {
		const element = hostRef.current;
		if (!element) {
			return;
		}
		const main = element;
		main.dataset.scheme = document.documentElement.dataset.scheme ?? "";
		let active = true;
		let scheduled = false;
		function announce() {
			if (scheduled) {
				return;
			}
			scheduled = true;
			queueMicrotask(() => {
				scheduled = false;
				if (!(active && contentReady(main, data, status, pending))) {
					return;
				}
				publishPage(main, data, status, url, onPage);
			});
		}
		const observer = new MutationObserver((records) => {
			if (records.some(affectsDocument)) {
				announce();
			}
		});
		observer.observe(main, { attributeFilter: ["data-source"], attributes: true, childList: true, subtree: true });
		announce();
		return () => {
			observer.disconnect();
			active = false;
		};
	}, [data, pending, status, onPage, url]);
	return hostRef;
}

function contentReady(main: HTMLElement, data: Document | undefined, status: string, pending: boolean) {
	if (pending || (!data && status === "200")) {
		return false;
	}
	return !data || main.querySelector<HTMLElement>("article.doc")?.dataset.source === documentSourceId(data);
}
function publishPage(main: HTMLElement, data: Document | undefined, status: string, url: string, onPage: (location: MainLocation) => void) {
	main.dataset.file = data?.file ?? "";
	main.dataset.url = data ? fileUrl(data.file) : url;
	if (data?.identity) {
		main.dataset.identity = data.identity;
	} else {
		delete main.dataset.identity;
	}
	flushSync(() => onPage({ file: data?.file ?? "", view: "" }));
	main.dataset.route = url;
	main.dataset.status = status;
	document.dispatchEvent(new Event("board-page"));
}
function affectsDocument(record: MutationRecord) {
	const element = record.target instanceof Element ? record.target : record.target.parentElement;
	return element?.matches(".document-layout") === true || Boolean(element?.closest("article.doc, .item-introduction"));
}
