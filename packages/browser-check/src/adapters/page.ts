import { Effect } from "effect";
import type { Page } from "playwright";
import type { BrowserLocator, BrowserPage } from "#BrowserPage.ts";
import { attempt } from "./attempt.ts";

export function pageAdapter(page: Page): BrowserPage {
	page.setDefaultTimeout(5000);
	let navigations = 0;
	page.on("framenavigated", (frame) => {
		if (frame === page.mainFrame()) {
			navigations += 1;
		}
	});
	function locator(target: BrowserLocator) {
		if ("label" in target) {
			return page.getByLabel(target.label, { exact: true });
		}
		const found = page.getByRole(target.role, { exact: true, ...(target.name === undefined ? {} : { name: target.name }) });
		return target.text === undefined ? found : found.filter({ hasText: target.text });
	}
	return {
		checkText: (text) => attempt(() => page.getByText(text, { exact: false }).filter({ visible: true }).first().waitFor({ state: "visible" })),
		click: (target) => attempt(() => locator(target).click()),
		fill: (target, value) => attempt(() => locator(target).fill(value)),
		navigationCount: Effect.sync(() => navigations),
		screenshot: (path) =>
			attempt(async () => {
				await page.screenshot({ fullPage: true, path });
			}),
		socket: (path) =>
			attempt(async () => {
				const socket = await page.waitForEvent("websocket", { predicate: (candidate) => new URL(candidate.url()).pathname === path });
				return {
					closed: attempt(async () => {
						await socket.waitForEvent("close");
					}),
					received: (matches: (payload: string) => boolean) =>
						attempt(async () => {
							await socket.waitForEvent("framereceived", { predicate: ({ payload }) => matches(payload.toString()) });
						}),
					sent: (matches: (payload: string) => boolean) =>
						attempt(async () => {
							await socket.waitForEvent("framesent", { predicate: ({ payload }) => matches(payload.toString()) });
						}),
				};
			}),
		visit: (url) =>
			attempt(async () => {
				const response = await page.goto(url);
				if (response === null || !response.ok()) {
					throw new Error(`Page ${url} returned HTTP ${response?.status() ?? "no response"}.`);
				}
			}),
		waitFor: (target, state = "visible") => attempt(() => locator(target).waitFor({ state })),
	};
}
