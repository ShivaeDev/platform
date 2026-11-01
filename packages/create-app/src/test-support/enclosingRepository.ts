import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { gitIn } from "./appReadouts.ts";
import { updates } from "./updates.ts";

export const enclosingRepository = updates.trait(
	"customized",
	"my-app is committed at apps/my-app with staged and unstaged sibling edits",
	(engine) =>
		Effect.sync(() => {
			rmSync(join(engine.target, ".git"), { recursive: true });
			mkdirSync(join(engine.root, "apps"));
			const target = join(engine.root, "apps/my-app");
			renameSync(engine.target, target);
			engine.target = target;
			writeFileSync(join(engine.root, ".gitignore"), "/bin/\n");
			writeFileSync(join(engine.root, "upgrade.txt"), "original\n");
			writeFileSync(join(engine.root, "added.txt"), "sibling file\n");
			for (const args of [
				["init", "--quiet"],
				["add", "--all"],
				["-c", "user.name=App", "-c", "user.email=app@example.com", "commit", "-qm", "Commit the enclosing repository"],
			]) {
				const result = gitIn(engine.root, args);
				if (result.status !== 0) {
					throw new Error(result.stderr);
				}
			}
			writeFileSync(join(engine.root, "upgrade.txt"), "staged sibling\n");
			const staged = gitIn(engine.root, ["add", "--", "upgrade.txt"]);
			if (staged.status !== 0) {
				throw new Error(staged.stderr);
			}
			writeFileSync(join(engine.root, "upgrade.txt"), "unstaged sibling\n");
		}),
);
