const COUNT = 160;

// Keep cold indexing cheap enough for cache stories under coverage on busy runners.
export const indexedWorkspace: Readonly<Record<string, string>> = Object.fromEntries(
	Array.from({ length: COUNT }, (_, index) => [
		`document-${index}.md`,
		`---
id: fixture.${index}
kind: task
status: draft
criteria:
 - id: done
   text: Verify this document
relationships:
 - kind: depends_on
   target: fixture.${(index + 1) % COUNT}#done
---
# Document ${index}

Read [related document](document-${(index + 2) % COUNT}.md).
`,
	]),
);
