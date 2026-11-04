import { Effect, FileSystem, Path } from "effect";
import { readTemplate, renderTemplate, writeGeneration } from "@shivaedev/create-app/generation.ts";
import { appTemplate } from "@shivaedev/create-app/template.ts";
import { command, requireThat } from "#package-check/io.ts";

export const restoreStarter = Effect.fn("Published.restoreStarter")(function* (app: string, directory: string, minimal: boolean) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const version = "0.35.0";
	yield* fs.makeDirectory(directory);
	const archive = (yield* command(directory, "npm", ["pack", `@shivaedev/create-app@${version}`, "--ignore-scripts", "--loglevel=error"])).trim();
	yield* command(directory, "tar", ["-xzf", path.join(directory, archive), "-C", directory]);
	yield* command(app, "git", ["reset", "--hard", "HEAD"]);
	if (!minimal) {
		yield* fs.remove(path.join(app, "src/adoption"), { recursive: true });
	}
	yield* command(app, "git", ["rm", "--quiet", "-r", "--", ".", ":!.agents", ":!CLAUDE.md"]);
	yield* renderTemplate(app, appTemplate(yield* readTemplate(path.join(directory, "package/template.json")), minimal), path.basename(app));
	yield* writeGeneration(app, { ...(minimal ? { minimal: true } : {}), name: path.basename(app), version });
	const home = path.join(app, "src/client/Home.tsx");
	const original = yield* fs.readFileString(home);
	yield* requireThat(original.includes("Your app"), "The previous starter must have a home-page heading to customize.");
	yield* fs.writeFileString(home, original.replace("Your app", "Our customized app"));
	yield* command(app, "git", ["add", "--all"]);
	const tree = (yield* command(app, "git", ["write-tree"])).trim();
	// Construct historical fixture history without rerunning setup or hooks against the retained current dependencies.
	const commit = (yield* command(app, "git", [
		"-c",
		"user.name=Starter Consumer",
		"-c",
		"user.email=starter@example.test",
		"commit-tree",
		tree,
		"-p",
		"HEAD",
		"-m",
		"Customize the historical starter",
	])).trim();
	yield* command(app, "git", ["update-ref", "HEAD", commit]);
});
