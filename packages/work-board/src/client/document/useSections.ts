import { createElement, Fragment, type ReactElement, startTransition, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type Components, MarkdownAsync } from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { PluggableList } from "unified";
import type { Document } from "#browser/document/schema.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { documentLinks } from "#render/documentLinks.ts";
import { documentPlugins } from "#render/documentPlugins.ts";
import { footnoteIds } from "#render/footnoteIds.ts";
import { tableColumns } from "#render/tableColumns.ts";
import { boardLayout } from "./boardLayout.ts";
import { highlightDocument } from "./highlight.ts";
import { documentLayout, documentSourceId } from "./layout.ts";
import { nextSection } from "./nextSection.ts";
import { documentSections } from "./sections.ts";

// Parsing past the budget shows up as a long task, and every commit lays out the whole document again, so commits grow further apart.
const TASK_BUDGET = 24;
const FIRST_COMMIT_GAP = 100;

export type BoardCounts = readonly { readonly count: number; readonly title: string }[];

interface Rendering {
	readonly board: BoardCounts | undefined;
	readonly components: Components;
	readonly document: Document;
	readonly idPrefix: string;
	readonly layout: boolean;
}

interface SectionsView {
	readonly complete: boolean;
	readonly error?: unknown;
	readonly key: string;
	readonly sections: readonly ReactElement[];
}

function sectionPlugins({ board, document, idPrefix, layout }: Rendering, index: number, used: Set<string>): PluggableList {
	const sourceId = documentSourceId(document);
	const plugins: PluggableList = [
		rehypeRaw,
		highlightDocument,
		footnoteIds(idPrefix),
		documentLinks(document.file, document.links),
		documentHeadings(index === 0, used).plugin,
		tableColumns,
	];
	if (board) {
		plugins.push([boardLayout, board, document.file, sourceId, layout]);
	} else if (layout && index === 0) {
		plugins.push([documentLayout, sourceId]);
	}
	return plugins;
}

async function renderSection(rendering: Rendering, source: string, index: number, used: Set<string>) {
	const element = await MarkdownAsync({
		children: source,
		components: rendering.components,
		rehypePlugins: sectionPlugins(rendering, index, used),
		remarkPlugins: documentPlugins(new Map(Object.entries(rendering.document.questionActions))),
	});
	return createElement(Fragment, { key: index }, element);
}

interface Progress {
	readonly cancelled: () => boolean;
	readonly key: string;
	readonly replacing: boolean;
	readonly show: (view: SectionsView) => void;
}

async function renderSections(rendering: Rendering, { cancelled, key, replacing, show }: Progress) {
	const sections = rendering.board ? [rendering.document.source] : documentSections(rendering.document.source);
	const used = new Set<string>();
	const rendered: ReactElement[] = [];
	let started = performance.now();
	let committed = Number.NEGATIVE_INFINITY;
	let gap = FIRST_COMMIT_GAP / 2;
	for (const [index, source] of sections.entries()) {
		rendered.push(await renderSection(rendering, source, index, used));
		if (cancelled()) {
			return;
		}
		const now = performance.now();
		const complete = index === sections.length - 1;
		const pause = index === 0 || now - started > TASK_BUDGET;
		// A page already on screen stays there until its update is complete, instead of shrinking back to the first section.
		if (complete || (pause && !replacing && now - committed >= gap)) {
			show({ complete, key, sections: [...rendered] });
			committed = now;
			gap *= 2;
		}
		if (pause && !complete) {
			await nextSection();
			started = performance.now();
		}
	}
}

export function useSections(rendering: Rendering) {
	const { board, document, idPrefix, layout } = rendering;
	const key = JSON.stringify([documentSourceId(document), idPrefix, board ?? null, layout]);
	const [view, setView] = useState<SectionsView>();
	const latestRef = useRef({ rendering, view });
	useLayoutEffect(() => {
		latestRef.current = { rendering, view };
	}, [rendering, view]);
	useEffect(() => {
		let cancelled = false;
		const { rendering: current, view: shown } = latestRef.current;
		function show(next: SectionsView) {
			startTransition(() => setView(next));
		}
		renderSections(current, { cancelled: () => cancelled, key, replacing: shown?.complete === true, show }).catch((error: unknown) => {
			if (!cancelled) {
				setView({ complete: false, error, key, sections: [] });
			}
		});
		return () => {
			cancelled = true;
		};
	}, [key]);
	if (view?.error !== undefined) {
		throw view.error;
	}
	return view ?? { complete: false, key, sections: [] };
}
