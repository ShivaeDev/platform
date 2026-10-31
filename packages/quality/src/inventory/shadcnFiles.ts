import { basename, join, matchesGlob, relative } from "node:path";
import { Effect } from "effect";
import { posix } from "./ignoreScope.ts";
import { shadcnFolders } from "./shadcnFolders.ts";
import { walk } from "./walk.ts";

// Registry item names are the CLI ownership convention; custom names stay authored.
const COMPONENTS = [
	"accordion",
	"alert",
	"alert-dialog",
	"aspect-ratio",
	"attachment",
	"avatar",
	"badge",
	"breadcrumb",
	"bubble",
	"button",
	"button-group",
	"calendar",
	"card",
	"carousel",
	"chart",
	"checkbox",
	"collapsible",
	"combobox",
	"command",
	"context-menu",
	"dialog",
	"direction",
	"drawer",
	"dropdown-menu",
	"empty",
	"field",
	"form",
	"hover-card",
	"input",
	"input-group",
	"input-otp",
	"item",
	"kbd",
	"label",
	"marker",
	"menubar",
	"message",
	"message-scroller",
	"native-select",
	"navigation-menu",
	"pagination",
	"popover",
	"progress",
	"radio-group",
	"resizable",
	"scroll-area",
	"select",
	"separator",
	"sheet",
	"sidebar",
	"skeleton",
	"slider",
	"sonner",
	"spinner",
	"switch",
	"table",
	"tabs",
	"textarea",
	"toast",
	"toaster",
	"toggle",
	"toggle-group",
	"tooltip",
];

export const SHADCN_FILE_GLOB = `{${COMPONENTS.join(",")}}.{ts,tsx,js,jsx}`;

export const shadcnFiles = Effect.fn("Inventory.shadcnFiles")(function* (root: string) {
	const folders = yield* shadcnFolders(root);
	const files = yield* Effect.forEach(folders, (folder) => walk(join(root, folder)));
	return [
		...new Set(
			files
				.flat()
				.filter((path) => matchesGlob(basename(path), SHADCN_FILE_GLOB))
				.map((path) => posix(relative(root, path))),
		),
	];
});
