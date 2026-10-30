import { join } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { Browser } from "#Browser.ts";

export interface CheckOptions {
	readonly credentials?: { readonly email: string; readonly password: string };
	readonly pages: readonly string[];
	readonly text: readonly string[];
	readonly url: string;
}

export const check = Effect.fn("BrowserCheck.check")(function* (options: CheckOptions) {
	const fs = yield* FileSystem.FileSystem;
	const browser = yield* Browser;
	const session = yield* browser.open;
	const folder = ".browser-check";
	yield* fs.makeDirectory(folder, { recursive: true });
	if (options.credentials !== undefined) {
		yield* session.signIn(new URL("/api/auth/sign-in/email", options.url).href, options.credentials.email, options.credentials.password);
	}
	for (const [index, path] of options.pages.entries()) {
		const url = new URL(path, options.url).href;
		yield* session.visit(url);
		const screenshot = join(folder, `${index + 1}.png`);
		for (const text of options.text) {
			yield* session.checkText(text);
		}
		yield* session.screenshot(screenshot);
		yield* Console.log(`browser-check: screenshot ${screenshot} (${url})`);
		yield* Console.log(`browser-check: smoke passed (${url})`);
	}
});
