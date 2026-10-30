import { fileURLToPath } from "node:url";

const vitest = JSON.stringify(fileURLToPath(import.meta.resolve("vitest")));

export const RAN = "ran.txt";
export const FLAKY = "checkout > recovers only in a fresh process";
export const BESIDE = "checkout > passes beside it";

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

const recordsRuns = `const ran = (name) => appendFileSync(${JSON.stringify(RAN)}, name + '\\n');`;

export function failingTimes(times: number, steadyProject: string | undefined): string {
	return `import { appendFileSync, readFileSync } from 'node:fs';
import { describe, expect, it } from ${vitest};
import { covered } from './covered.ts';

${recordsRuns}
let poisoned = false;
describe('checkout', () => {
	it('recovers only in a fresh process', () => {
		if (process.env.PROJECT === ${JSON.stringify(steadyProject ?? null)}) {
			return;
		}
		expect(poisoned).toBe(false);
		poisoned = true;
		ran(${JSON.stringify(FLAKY)});
		const attempt = readFileSync(${JSON.stringify(RAN)}, 'utf8').split('\\n').filter((line) => line === ${JSON.stringify(FLAKY)}).length;
		if (attempt <= ${times}) {
			throw new Error('Attempt ' + attempt + ' leaves module state behind');
		}
		expect(covered()).toBe(2);
	});
	it('passes beside it', () => {
		ran(${JSON.stringify(BESIDE)});
	});
});
`;
}

export const alwaysFailing = `import { appendFileSync } from 'node:fs';
import { it } from ${vitest};

${recordsRuns}
it('stays broken', () => {
	ran('stays broken');
	throw new Error('Still broken');
});
`;

export const passing = `import { appendFileSync } from 'node:fs';
import { expect, it } from ${vitest};
import { alsoCovered } from './covered.ts';

${recordsRuns}
it('passes', () => {
	ran('passes');
	expect(alsoCovered()).toBe(1);
});
`;

export const collectionFailingOnce = `import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { it } from ${vitest};

${recordsRuns}
if (!existsSync('collected.txt')) {
	writeFileSync('collected.txt', 'failed');
	throw new Error('Collection fails once');
}
it('passes once collected', () => {
	ran('passes once collected');
});
`;

export const unhandledError = `import { it } from ${vitest};

it('leaves an unhandled error', async () => {
	setTimeout(() => {
		throw new Error('Unhandled fixture error');
	}, 0);
	await new Promise((resolve) => setTimeout(resolve, 0));
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
