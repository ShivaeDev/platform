import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import process from "node:process";

export function pausePublication() {
	const original = fs.link;
	fs.link = async (...args: Parameters<typeof fs.link>) => {
		await original(...args);
		if (/\/fleet-report\.[a-f\d]+\.md$/u.test(String(args[1]))) {
			process.send?.("published");
			await new Promise<void>(() => undefined);
		}
	};
	syncBuiltinESMExports();
}
