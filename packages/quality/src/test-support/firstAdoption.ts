export const MIXED_DEBT = {
	content: `await Promise.resolve();\n${"\t".repeat(8)}String(1);\n`,
	path: "src/work.ts",
};

export const GROWN_DEBT = { ...MIXED_DEBT, content: `${MIXED_DEBT.content}await Promise.resolve();\n` };
