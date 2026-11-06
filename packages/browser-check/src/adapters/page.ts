import type { Page } from "playwright";
import type { BrowserPage } from "#BrowserPage.ts";
import { attempt } from "./attempt.ts";
import { watchSocket } from "./watchSocket.ts";

export function pageAdapter(page: Page): BrowserPage {
	page.setDefaultTimeout(5000);
	return {
		checkText: (text) => attempt(() => page.getByText(text, { exact: false }).filter({ visible: true }).first().waitFor({ state: "visible" })),
		screenshot: (path) =>
			attempt(async () => {
				await page.screenshot({ fullPage: true, path });
			}),
		visit: (url) =>
			attempt(async () => {
				const response = await page.goto(url);
				if (response === null || !response.ok()) {
					throw new Error(`Page ${url} returned HTTP ${response?.status() ?? "no response"}.`);
				}
			}),
		watchSocket: (url) => watchSocket(page, url),
	};
}
