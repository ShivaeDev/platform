# Visual document conventions

Work Board parses these directives with `remark-directive` and renders their
body through its Markdown/GFM pipeline. These are
Markdown extensions, not built-in CommonMark elements. Other readers can show
literal directive markers and readable Markdown contents. No migration of ordinary
Markdown or D1 frontmatter is required.

## Fixed component vocabulary

Use `:::metric`, `:::progress` or `:::timeline` containers. Start each with a
nonblank Markdown label paragraph. Body text, links and emphasis remain Markdown.
Attribute values are strings decoded with Effect Schema; unknown attributes are
not interpreted. Values are recorded source claims, never verified acceptance.

### Metric

```markdown
:::metric{value="50" unit="documents"}
Representative fixture target

Source: [Reading checks](browser-acceptance.md)
:::

:::metric{value="unknown" unit="seconds"}
Representative-reader orientation

Source: [Reader acceptance](../roadmap.md)
:::
```

`unit` is required and nonblank. `value` is a finite number, `unknown`, or omitted.
An unknown or omitted value displays “Not recorded”, never zero. Preserve a
source paragraph beginning `Source:` with a Markdown link. Source links identify
provenance; their existence or statements are not verified by the component.

### Progress

```markdown
:::progress{completed="3" total="8"}
Example reading checks recorded

This tally records checks, not verified acceptance.

Source: [Reading checks](browser-acceptance.md)
:::
```

`completed` and `total` are nonnegative safe integers, `unknown`, or omitted.
Known counts require `completed <= total`. Only a known positive total produces
a native, labeled progress bar. Missing/unknown counts and 0/0 retain their
explicit tally and say “Percentage unavailable”. Counts are never inferred from
statuses, owners, task lists or criterion evidence. A `Source:` linked paragraph
is required. A zero completed count is a recorded zero, not missing information.

### Timeline

```markdown
:::timeline
Reading delivery

1. **First:** inspect [source conventions](source-examples.md).
2. **Then:** review [response context](response-write-examples.md).
:::
```

Use one ordered list containing 1–100 entries. Each entry needs text and a source
link. Keep author order and literal labels, including planned/recorded qualifiers;
do not parse dates, infer deadlines, schedule work or derive agent state. Timeline
attributes are not supported. Ordinary Markdown emphasis and links remain intact.
Mermaid continues to handle diagrams, including its own timeline diagram syntax.

## Callouts and comparisons

Use GitHub's five alert markers: NOTE, TIP, IMPORTANT, WARNING and CAUTION.
Unknown markers stay ordinary blockquotes. Comparisons stay GFM tables, as D1
already specifies; colors, columns and ordering never select an option or assert
an approval.

```markdown
> [!IMPORTANT]
> A recorded browser result does not establish representative-reader acceptance.

| Option | Benefit | Cost | Source |
| --- | --- | --- | --- |
| Ordinary Markdown | Familiar everywhere | Fewer visual affordances | [Source conventions](source-examples.md) |
| Fixed directives | Explicit visual intent | An extension to document | [Delivery plan](wave1.md) |
```

## Fallback and ownership

- Unknown/invalid containers, unknown attributes, missing labels/sources, invalid
  ratios and nonfinite values retain the complete original source as code with a
  local diagnostic. Later components and ordinary prose stay readable.
- Inline/leaf visual forms are unsupported. Inline directives retain their
  literal source; unsupported leaf forms show source and a diagnostic. Unclosed
  or malformed syntax follows the established directive parser's reading rules.
- A component is limited to 64 KiB of source. Nested visual directives are
  unsupported; original source remains visible.
- Render fixed semantic elements on the server. No author-supplied JavaScript,
  JSX, executable MDX, templates, queries, plugin loading or remote data fetching.
- Preserve headings, local links, search/backlinks, print text alternatives,
  native update ownership and the explicit Mark seen baseline. No source writes,
  new D1 fields, YAML visual fences or acceptance inference.
