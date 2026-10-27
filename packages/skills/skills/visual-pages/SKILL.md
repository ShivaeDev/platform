---
name: visual-pages
description: "Use this skill before creating, editing or reviewing a claude.ai Artifact or other HTML page that someone reads: a report, explainer, decision page, tracker, dashboard or replay. It decides what the page shows and how it reads, so the reader gets the answer from the figures in one look."
metadata:
  user-invocable: "true"
---

# Visual pages

This is the design language for every claude.ai Artifact and HTML page you make. It decides what goes on the page. The mechanics come from the host: in claude.ai, `artifact-design` covers the page contract and theming, `artifact-capabilities` the database, comments and other runtime features, `artifact-diagramming` SVG, and `dataviz` chart forms and palettes. Elsewhere, follow the host's own rules for those. Where a mechanics skill disagrees with this one on content, density or ambition, this skill wins.

The reader takes one look and gets it. Within about five seconds they see how the pieces connect and what the answer is, and can act on it. A page that looks visual but reads as prose has failed, however short, tidy or colourful it is.

## The reader

- Wants a high-level answer, not everything the agent learned on the way.
- Sits at a desktop browser with JavaScript on, and engages with the page: presses play, clicks, hovers, scrubs, drags a slider.
- Does not need to be convinced in court. Hedging and self-justification cost attention and buy nothing.

## Process

1. **Write the answer first.** One sentence each: the question the reader has, and the answer they should walk away with. If the reader has to choose something, the page is a decision page. If there is no answer, only something to look at (a fortnight of activity, a series of posts), the page is an exploration and needs no takeaway.
2. **Find the points.** List the two to five things the reader must see to believe the answer. Each point becomes one figure. If a point is a single fact, it becomes a label on another figure, not a figure of its own.
3. **Pick a form for each point** from the table in "Choosing the figure". Ask the second question every time: is this about order, or about state?
4. **Sketch bigger.** Name two or three distinct concepts for the page in one line each. At least one must be bolder than a static diagram: a replay of the real run, a simulator with a slider, an animation of the mechanism, a map you can poke. Pick the one a reader gets fastest. The first layout that works is usually the one that ends up "good but not great".
5. **Get the real data.** Pull the actual events, numbers and timings from the source and embed them. A replay of invented events is a cartoon. Mark any number you had to invent as illustrative, on the figure itself.
6. **Plan each figure** before writing code: its claim in one sentence, its form, what is lit at one time, each control and what it changes, and a caption of at most 20 words.
7. **Build** to the rules below.
8. **Look once.** Render the page and run the review checklist at the end of this skill. Fix what it finds in one pass, publish, and stop. Further polish waits until the reader asks for it.

## Choosing the figure

| The point is about | Draw |
|---|---|
| What exists and how it connects | a system map |
| Capacity, ownership or containment | the resources in fixed positions, changing state in place |
| How something unfolded | a replay of the real data, with play, speed, scrubber and clock |
| Order of steps, or a decision path | a sequence, timeline or flow |
| Which option to take | the same figure once per option, side by side, the difference highlighted |
| What happens if a value changes | a simulator: a labelled slider that redraws the figure and its result |
| Change over time | a line, with the windows that matter bracketed and the step annotated |
| Comparing categories | bars, sorted, the one that matters in the accent colour |
| Part of a whole, sized by importance | a treemap or proportional tiles |
| Many connected items | a graph whose hover spotlights one item's connections |
| Exact values someone will look up | a table, and only then |

**Order or state?** When the behaviour is explained by something filling up, being held or running out (a pool, a queue, a host's slots, a budget), draw the resources in fixed positions and change their state. A chain of boxes saying "pool full, wait, reuse" hides the very thing that matters.

**A sentence that describes a relationship belongs in the figure.** If you catch yourself writing "A calls B, which waits for C", draw it.

### Instead of this, draw that

- Nine step cards describing two merge chains → one dependency graph, each chain a lane, the order of merges visible as arrows.
- A paragraph explaining why requests failed → the hosts drawn as slots that fill, queue and spill while the clock runs.
- A row of hero tiles with current values → each number as a small line of its history, current value at the end.
- A table under a graph listing the graph's links → hover on the graph that lights one node's links.
- Options described in prose with a recommendation paragraph → the same diagram drawn once per option, the changed edge highlighted, and a control to choose.
- Before and after described in text → the same figure twice, side by side, or one figure with a toggle between the two states.
- A legend paragraph explaining six colours → two or three colours whose meaning is obvious from their labels.

## Building the figures

**System map.** Each place where things run (a service, a queue, a browser, a warehouse) is one area, with its parts inside. Start where the data is created and end where someone reads it. Give each kind of trigger its own line style (continuous, on demand, scheduled) and key it once. Number the stations when the text walks through them. Never merge unrelated places to tidy the layout. About 14 boxes in up to six areas; past that, an overview map plus a focused map of the part that matters.

**State in place.** Draw each resource once, at a fixed position, sized by its capacity. Show its state as fill, colour or count inside it. When time matters, the resources stay put while their state changes, so the eye can follow one of them.

**Replay.** The data is a list of timestamped events. The page holds a clock, a function that turns the events up to that time into the current state, and a drawing of that state. Give it play and pause, a few speeds (10× to 120× for minutes of real time), a scrubber the reader can drag, and an event strip above the scrubber marking what happened when, each marker clickable to jump there. Every counter on the page follows the clock. Open on the most telling frame, with play ready.

**Options side by side.** Draw the same diagram once per option, same layout, same positions, so the only thing that differs is the thing that differs. Highlight that difference. Put the trade-off for each option as one line under its drawing.

**Simulator.** A slider or toggle that changes an input, with the figure and the result redrawn together as it moves. Label every control with what it is and its unit. Show which numbers are measured and which are illustrative.

**Charts.** Follow `dataviz`, when the host has it, for the mechanics. On top of it: annotate the moment that matters on the chart itself, bracket the windows being compared, colour the series the story is about and mute the rest, and state units, time window and source in the caption. Never a dual axis.

**Spotlight.** A figure may hold far more than five things when hovering or selecting lights one slice and dims the rest. Each lit slice must stay within two to five things. Clicking an item pins it and opens a side panel with its detail and a link to the real thing (the dashboard, the pull request, the trace), so the overview stays clean and the depth is one click away.

**Numbers.** A number worth showing comes with its history: a small chart of how it got there, the current value at the end. A row of bare hero tiles is a billboard, still a wall of text.

## Page shapes

**Decision page.** Used whenever the reader must choose. In order:

1. How the system works, drawn, just enough to follow the options.
2. The concrete situation that forces the choice, drawn.
3. Each option drawn the same way, the difference highlighted, the trade-off in one line.
4. The questions as choices the reader clicks on the page, each with an optional note, stored where you can read them back: in a claude.ai Artifact, the artifact's database (load `artifact-capabilities`); elsewhere, whatever persistent store the page has.

When the decision is many small calls rather than one big one (which of 33 dependencies to upgrade, which of 40 findings to fix), draw all the items in one figure showing where each goes from today to after, each with your proposed verdict as its colour. Clicking an item opens it in a side panel with what changes and Agree / Change it / Not sure plus a note. A counter shows how many are reviewed.

Read the answers back (in claude.ai, with `ArtifactData`) and carry on with the work. One page per decision; the page is finished when its questions are answered. Never grow one page into a queue that collects every decision forever.

**Tracker.** A picture of the whole on top (a map or treemap sized by what matters, coloured by state), rows the reader edits in place below it, detail opening on click. State lives in the page's persistent store, not in the page source. A tracker has an end: when the effort is done, say so on the page and stop updating it.

**Replay or case study.** The answer as the headline, the replay or the drawn mechanism straight under it, then at most two or three supporting figures. What was fixed and what is still open, drawn as two groups, not two paragraphs.

**Explainer.** One worked example with real values, carried through the page. The mechanism drawn step by step, each step changing the drawing. Each shape or colour introduced once, with its meaning, and never reused for anything else.

**Exploration.** A heatmap, map or graph the reader pokes at, with linked views that redraw on selection. The title names what you are looking at. No takeaway, no summary.

**Data report.** The claim as the headline, with its number. One chart per point, each annotated where the story happens. No dashboard grid of every metric; a report is not a dashboard.

## Rules

The rules are not equal. Shape comes first: the right form, the mechanism drawn, the answer visible, little prose. Colour, labels and legend wording are polish. Fix them when it is cheap, and never trade a better shape for better colours.

**Purpose**

- **Five-second answer.** Everything on the page serves the one-look answer or goes.
- **Show, don't tell.** Relationships, changes, flows and comparisons are figures. Prose is captions and short labels, about a third of the page at most. Concise prose is still a wall.
- **No caveat theatre.** No hedges, not-confirmed lists, method notes or self-justification. Keep a caveat only if it would change the reader's decision, and put it next to the claim it qualifies.
- **High level only.** Leave out detail nobody asked for: file and line lists, edge cases, every row, the history of how you found it. If something still feels important, put it in one section at the bottom, collapsed by default, labelled as more detail.

**Build**

- **Small figures.** Two to five things lit at once, about eight at most. Without a spotlight, split into an overview and a focused view.
- **Never restate.** No table, cards or paragraphs under a figure that repeat what it shows. Spend the space on the figure.
- **Headline answers.** A page that makes a claim states it in the headline, with its number. A title that only names the topic wastes the most-read line on the page.
- **Interaction earns its place.** A control changes the figure and its result together. A Next button that only swaps text, or a tab that hides content for no reason, is decoration.
- **One colour, one meaning** across the whole page. Label only the arrows that need it, in one or two words. A legend that needs a paragraph means the encoding is wrong.
- **Desktop fidelity.** Build for a desktop browser with JavaScript on. Use any library and embed as much data as the picture needs. Make figures big. Keep the host's basic responsive rules, but spend no effort on phone layouts, page weight or no-JavaScript fallbacks.

## Words

- **Title:** the answer, or for an exploration the name of what you are looking at.
- **Lede:** one or two sentences under the title, only if the figure needs setting up.
- **Captions:** at most 20 words, saying what the figure proves, not what it is.
- **Labels:** one to three words. Arrow labels one or two.
- **Everything else:** cut it, or put it in the collapsed section at the bottom.
- Write plainly and briefly. Spell out acronyms the reader may not know, once, on the figure.

## Failure catalogue

These are the ways pages fail most often. Check for each before publishing.

- **Text in costume.** Cards, callouts and coloured boxes that each hold a paragraph. It looks visual and reads as prose.
- **Figures that do not carry the argument.** A diagram sits on the page while the actual reasoning lives in the paragraphs around it.
- **Boxes that only name things.** A row of component names joined by arrows, with nothing about what flows, what waits or where it breaks.
- **The billboard.** Hero tiles with bare numbers at the top.
- **The repeat.** A table under the chart, or a summary paragraph after the diagram, saying the same thing again.
- **The caveat block.** Method notes, "not confirmed" lists, or a "before you celebrate" section far from the claims they qualify.
- **The first layout.** A competent page in the first shape that came to mind, with no bolder concept tried.
- **The dashboard reflex.** Metric cards, then charts, then tables, whatever the question was.
- **Decorative interaction.** Tabs, accordions or steppers that hide text instead of changing a picture.
- **The forever page.** One tracker or decision queue that keeps growing after its job is done.

## Review checklist

Look at the rendered page once and answer each question honestly:

1. Cover the text and look only at the figures for five seconds. Is the answer clear?
2. Is prose more than about a third of the page? Turn the longest paragraph into a figure or cut it.
3. Does any figure only name components? Draw what moves, waits or breaks.
4. Is anything stated twice, in a figure and again in text or a table? Keep the figure.
5. Is there a caveat or method section? Delete it, or move the one caveat that matters next to its claim.
6. Are there bare number tiles? Give each its history, or remove it.
7. Does every control change the picture?
8. Does any figure need a paragraph-long legend? Simplify the encoding.
9. Would the bolder concept from step 4 have landed faster? If clearly yes, say so in the reply.

## The reply

The page carries the content. The chat reply is the link plus one or two lines: what the page answers and which concept you chose. Never summarise the page in chat.
