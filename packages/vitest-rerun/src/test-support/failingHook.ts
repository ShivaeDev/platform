import { fileURLToPath } from "node:url";

const vitest = JSON.stringify(fileURLToPath(import.meta.resolve("vitest")));

export function failingHook(hook: "beforeAll" | "afterAll", times: number, topLevel: boolean): string {
	const body = `
let poisoned = false;
${hook}(() => {
	expect(poisoned).toBe(false);
	poisoned = true;
	appendFileSync('${hook}.txt', process.pid + '\\n');
	const attempt = readFileSync('${hook}.txt', 'utf8').trim().split('\\n').length;
	if (attempt <= ${times}) throw new Error('${hook} fails on attempt ' + attempt);
});
it('runs inside the suite', () => appendFileSync('inside.txt', 'passed\\n'));
`;
	return `import { appendFileSync, readFileSync } from 'node:fs';
import { ${hook}, describe, expect, it } from ${vitest};
${topLevel ? body : `describe('checkout', () => { describe('payment', () => { ${body} }); });`}
it('passes outside the suite', () => appendFileSync('outside.txt', 'passed\\n'));
`;
}
