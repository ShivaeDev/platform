import { fileURLToPath } from "node:url";

const vitest = JSON.stringify(fileURLToPath(import.meta.resolve("vitest")));

export interface SuiteConfig {
	coverage: boolean;
	projects: readonly string[];
}

export function vitestConfig(root: string, { coverage, projects }: SuiteConfig): string {
	const include = "include: ['*.spec.ts']";
	const tests =
		projects.length === 0
			? include
			: `projects: [${projects.map((name) => `{ extends: true, test: { name: '${name}', ${include}, env: { PROJECT: '${name}' } } }`).join(", ")}]`;
	const coverageOptions = coverage
		? ", coverage: { enabled: true, provider: 'v8', include: ['covered.ts'], reporter: ['lcov'], reportOnFailure: true, reportsDirectory: 'coverage' }"
		: "";
	return `export default { root: ${JSON.stringify(root)}, cacheDir: '.vite', test: { ${tests}${coverageOptions} } };\n`;
}

export function failingTimes(times: number, steadyProject: string | undefined): string {
	return `import { appendFileSync, readFileSync } from 'node:fs';
import { describe, expect, it } from ${vitest};
import { covered } from './covered.ts';

let poisoned = false;
describe('checkout', () => {
	it('recovers only in a fresh process', () => {
		if (process.env.PROJECT === ${JSON.stringify(steadyProject ?? null)}) {
			return;
		}
		expect(poisoned).toBe(false);
		poisoned = true;
		appendFileSync('attempts.txt', 'attempt\\n');
		const attempt = readFileSync('attempts.txt', 'utf8').split('\\n').length - 1;
		if (attempt <= ${times}) {
			throw new Error('Attempt ' + attempt + ' leaves module state behind');
		}
		expect(covered()).toBe(2);
	});
	it('passes beside it', () => {
		appendFileSync('beside.txt', 'passed\\n');
	});
});
`;
}

export const alwaysFailing = `import { appendFileSync } from 'node:fs';
import { it } from ${vitest};

it('stays broken', () => {
	appendFileSync('broken.txt', 'attempt\\n');
	throw new Error('Still broken');
});
`;

export const passing = `import { appendFileSync } from 'node:fs';
import { expect, it } from ${vitest};
import { alsoCovered } from './covered.ts';

it('passes', () => {
	appendFileSync('passed.txt', 'passed\\n');
	expect(alsoCovered()).toBe(1);
});
`;

export const collectionFailingOnce = `import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { it } from ${vitest};

if (!existsSync('collected.txt')) {
	writeFileSync('collected.txt', 'failed');
	throw new Error('Collection fails once');
}
it('passes once collected', () => {
	appendFileSync('collected-passed.txt', 'passed\\n');
});
`;

export const unhandledError = `import { it } from ${vitest};

it('leaves an unhandled error', async () => {
	setTimeout(() => {
		throw new Error('Unhandled fixture error');
	}, 0);
	await new Promise((resolve) => setTimeout(resolve, 25));
});
`;

export const COVERED_MODULE = "export function covered() {\n\treturn 2;\n}\nexport function alsoCovered() {\n\treturn 1;\n}\n";

function perAttempt(body: string): string {
	return `import { appendFileSync, readFileSync } from 'node:fs';
import { it } from ${vitest};

appendFileSync('collections.txt', 'attempt\\n');
const attempt = readFileSync('collections.txt', 'utf8').split('\\n').length - 1;
${body}`;
}

export const passingThenFailing = perAttempt(`
it('settles in the first attempt', () => {
	if (attempt > 1) {
		throw new Error('Later attempts fail');
	}
});
`);

export const failingThenSkipped = perAttempt(`
(attempt === 1 ? it : it.skip)('is skipped by the rerun', () => {
	throw new Error('The first attempt fails');
});
`);

export const gainingTest = perAttempt(`
it('fails first', () => {
	if (attempt === 1) {
		throw new Error('The first attempt fails');
	}
});
if (attempt > 1) {
	it('appears in the rerun', () => {});
}
`);

export const losingTest = perAttempt(`
if (attempt === 1) {
	it('disappears in the rerun', () => {
		throw new Error('The first attempt fails');
	});
}
it('stays', () => {});
`);
