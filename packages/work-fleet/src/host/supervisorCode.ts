import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fromSource = import.meta.url.endsWith(".ts");
const ownManifest = fileURLToPath(new URL("../../package.json", import.meta.url));

function packageManifest(name: string, from: string) {
	for (const directory of createRequire(from).resolve.paths(name) ?? []) {
		const file = join(directory, name, "package.json");
		if (existsSync(file)) {
			return realpathSync(file);
		}
	}
	throw new Error(`Cannot resolve ${name} from ${from}`);
}

function fleetManifest(boardDir: string) {
	try {
		return packageManifest("@shivaedev/work-fleet", join(boardDir, "package.json"));
	} catch {
		return ownManifest;
	}
}

interface Manifest {
	readonly dependencies?: Readonly<Record<string, string>>;
}

export interface RunningCode {
	readonly entry: string;
	readonly revision: string;
}

export function codeReader(boardDir: string) {
	const cache = new Map<string, { readonly stamp: string; readonly digest: string }>();
	function digest(file: string) {
		const stat = statSync(file);
		const stamp = `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
		const previous = cache.get(file);
		if (previous?.stamp === stamp) {
			return previous.digest;
		}
		const value = createHash("sha256").update(readFileSync(file)).digest("hex");
		cache.set(file, { digest: value, stamp });
		return value;
	}
	function tree(directory: string, hash: ReturnType<typeof createHash>) {
		for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			if (entry.name === "test-support" || /\.(?:spec|test)\./u.test(entry.name)) {
				continue;
			}
			const path = join(directory, entry.name);
			if (entry.isDirectory()) {
				tree(path, hash);
			} else if (/\.(?:[cm]?[jt]sx?|json|css|html)$/u.test(entry.name) && !entry.name.endsWith(".d.ts")) {
				hash.update(path).update(digest(path));
			}
		}
	}
	function code(manifest: string, entry: string): RunningCode {
		const hash = createHash("sha256");
		const visited = new Set<string>();
		function visit(file: string) {
			const resolved = realpathSync(file);
			if (visited.has(resolved)) {
				return;
			}
			visited.add(resolved);
			hash.update(resolved).update(digest(resolved));
			const root = dirname(resolved);
			const pkg: Manifest = JSON.parse(readFileSync(resolved, "utf8"));
			tree(join(root, fromSource ? "src" : "dist"), hash);
			if (!fromSource && file === boardManifest) {
				tree(join(root, "assets"), hash);
			}
			for (const dependency of Object.keys(pkg.dependencies ?? {})
				.filter((name) => name.startsWith("@shivaedev/"))
				.sort((a, b) => a.localeCompare(b))) {
				visit(packageManifest(dependency, resolved));
			}
		}
		visit(manifest);
		return { entry: join(dirname(manifest), fromSource ? `src/${entry}.ts` : `dist/${entry}.js`), revision: `sha256:${hash.digest("hex")}` };
	}
	let boardManifest = "";
	return () => {
		const fleet = fleetManifest(boardDir);
		boardManifest = packageManifest("@shivaedev/work-board", fleet);
		return { board: code(boardManifest, "server/cli"), daemon: code(fleet, "cli") };
	};
}
