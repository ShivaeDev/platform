import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

export function responseDirectory(root: string) {
	mkdirSync(join(root, "responses"), { recursive: true });
}
export function responseLink(root: string, name: string, target: string) {
	symlinkSync(target, join(root, "responses", name));
}
export function outsideResponseDirectory(root: string, target: string) {
	symlinkSync(target, join(root, "responses"));
}
