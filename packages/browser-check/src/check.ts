import { Console, Effect, FileSystem } from "effect";
import { Browser } from "#Browser.ts";
import { BrowserCheckError } from "#BrowserCheckError.ts";

export interface CheckOptions {
	readonly credentials?: { readonly email: string; readonly password: string };
	readonly pages: readonly string[];
	readonly text: readonly string[];
	readonly url: string;
}

function httpUrl(value: string, flag: string, base?: URL) {
	function invalid() {
		return new BrowserCheckError({
			message: `Invalid ${flag}: expected ${base === undefined ? "an absolute HTTP(S) URL" : "an HTTP(S) URL or page path"}.`,
		});
	}
	return Effect.gen(function* () {
		const url = yield* Effect.try({ catch: invalid, try: () => new URL(value, base) });
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return yield* invalid();
		}
		return url;
	});
}

export const check = Effect.fn("BrowserCheck.check")(function* (options: CheckOptions) {
	const fs = yield* FileSystem.FileSystem;
	const folder = ".browser-check";
	yield* fs.remove(folder, { force: true, recursive: true });
	const base = yield* httpUrl(options.url, "--url");
	const urls = yield* Effect.forEach(options.pages, (path) => httpUrl(path, "--page", base).pipe(Effect.map((url) => url.href)));
	const browser = yield* Browser;
	const session = yield* browser.open;
	yield* fs.makeDirectory(folder, { recursive: true });
	if (options.credentials !== undefined) {
		yield* session.signIn(new URL("/api/auth/sign-in/email", base).href, options.credentials.email, options.credentials.password);
	}
	const page = yield* session.newPage;
	for (const [index, url] of urls.entries()) {
		yield* page.visit(url);
		const screenshot = `${folder}/${index + 1}.png`;
		for (const text of options.text) {
			yield* page.checkText(text);
		}
		yield* page.screenshot(screenshot);
		yield* Console.log(`browser-check: screenshot ${screenshot} (${url})`);
		yield* Console.log(`browser-check: smoke passed (${url})`);
	}
});
