import { WIDE_TABLE } from "./wideTableFixture.ts";

function section(index: number) {
	const paragraph = `Finding ${index} records what the reviewer checked, which files it touched and why the result holds for this revision. `.repeat(
		6,
	);
	return `## Finding ${index}\n\n${paragraph}\n\n### Evidence ${index}\n\n${index % 5 === 0 ? WIDE_TABLE : `- Checked file ${index}.\n- Repeated the scan.\n`}\n`;
}

export const LONG_REPORT_TITLE = "Long research report";
export const LATE_HEADING = "heading-late-follow-up";

// Long enough that the reader renders it section by section, with the heading a deep link targets in the last section.
export const LONG_REPORT = `---
id: report.long-research
kind: report
---
# ${LONG_REPORT_TITLE}

Opening summary of the research.

${Array.from({ length: 40 }, (_, index) => section(index + 1)).join("\n")}
## Late follow-up

The last section a deep link opens.
`;

const filler = Array.from({ length: 60 }, (_, index) => `## Filler ${index}\n\n${"Plain reading text for the section. ".repeat(10)}\n`).join("\n");

// Headings inside a comment, a fence, raw HTML or a directive must stay where one render of the whole document puts them; an unused
// reference definition keeps the whole document in one section.
export const SECTIONED_TITLE = "Sectioned report";
export const SECTIONED_DOCUMENT = `# ${SECTIONED_TITLE}

Opening paragraph.

<!-- A comment that spans lines

# Not a heading inside the comment
-->

## Code

\`\`\`md
A fenced example.

# Not a heading inside the fence
\`\`\`

<details>
<summary>Steps</summary>

## Inside the details

Hidden text.

</details>

:::note

## Inside a directive

:::

## Repeat

| Check | Result |
| --- | --- |
| lint | pass |

${filler}
## Repeat

Last section.
`;

export const WHOLE_DOCUMENT = `${SECTIONED_DOCUMENT}\n[unused]: https://example.com\n`;

export const REFERENCED_DOCUMENT = `# Referenced report

See [the guide][guide] and the claim.[^source]

${filler}
[guide]: guide.md
[^source]: Read the source.
`;
