import { expect } from "vitest";

export function navigationExpected() {
	const docs = {
		active: false,
		count: 1,
		files: [],
		folders: [
			{
				active: false,
				count: 1,
				files: [
					{
						current: false,
						href: "/docs/%3Clong%20%26%20%22name%3E/a%20%23%3F.md",
						modified: expect.any(Number),
						name: "a #?",
						path: 'docs/<long & "name>/a #?.md',
					},
				],
				folders: [],
				name: '<long & "name>',
				path: 'docs/<long & "name>',
			},
		],
		name: "docs",
		path: "docs",
	};
	const packages = {
		active: true,
		count: 2,
		files: [],
		folders: [
			{
				active: false,
				count: 1,
				files: [
					{ current: false, href: "/packages/changes/guide.md", modified: expect.any(Number), name: "guide", path: "packages/changes/guide.md" },
				],
				folders: [],
				name: "changes",
				path: "packages/changes",
			},
			{
				active: true,
				count: 1,
				files: [{ current: true, href: "/packages/form/README.md", modified: expect.any(Number), name: "README", path: "packages/form/README.md" }],
				folders: [],
				name: "form",
				path: "packages/form",
			},
		],
		name: "packages",
		path: "packages",
	};
	return {
		inboxCount: 1,
		records: {
			active: false,
			count: 1,
			files: [{ current: false, href: "/responses/decision.md", modified: expect.any(Number), name: "decision", path: "responses/decision.md" }],
		},
		tree: {
			active: true,
			count: 6,
			files: [
				{ current: false, href: "/packages/README.md", modified: expect.any(Number), name: "README", path: "packages/README.md" },
				{ current: false, href: "/question.md", modified: expect.any(Number), name: "question", path: "question.md" },
				{ current: false, href: "/root.md", modified: expect.any(Number), name: "root", path: "root.md" },
			],
			folders: [docs, packages],
			name: "",
			path: "",
		},
	};
}
