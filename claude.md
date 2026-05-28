# Coding Philosophy

> "We don't simply 'Make it work'—we 'Make it correctly'"

We aren't building MVPs or Prototypes. 
We are creating useful software applications that solve real problems.
We don't look for workarounds or quickfixes. 



## When Writing code
Ensure modularity, extensibility and testability by following Inversion of Control (IoC) design principles.

## Python:

Use:
- PEP 8 coding conventions
- `structlog` for structured JSON logging, capturing important events such as function entry/exit, errors, and state changes
- PEP 484 Type Hints conventions
- Docstrings follow Google Styleguide

## Go:

Use:
- Effective Go conventions (https://go.dev/doc/effective_go)
- `zerolog` for structured JSON logging, capturing important events such as function entry/exit, errors, and state changes
- Explicit error handling with wrapped context via `fmt.Errorf("context: %w", err)`
- GoDoc comment conventions (https://go.dev/doc/comment)
- Context propagation via `context.Context` as first parameter where applicable
- Table-driven tests with `t.Run()` subtests

## JavaScript/TypeScript:

Use:
- ES Modules (`"type": "module"` in package.json, `import/export` syntax)
- ESLint with recommended rules for consistent code style
- `pino` for structured JSON logging, capturing important events such as function entry/exit, errors, and state changes
- TypeScript strict mode (`"strict": true`) for maximum type safety
- JSDoc comments for JavaScript; TSDoc conventions for TypeScript
- Explicit return types on exported functions
- `async/await` over raw Promises; always handle rejections
- Named exports over default exports for better refactoring support

## Bash:

Use:
- Bash 3.2 compliance

# Policies
The following policies are designed to ensure clarity, consistency, and code safety for all work.

## 'No Assumptions' Policy
Never assume:
- File structure, imports, or dependencies without reading the files
- Coding patterns or conventions - verify against existing code
- Configuration values, paths, or environment variables
- API contracts, function signatures, or data structures

Before planning or implementing any task:
1. **Read the actual code** - don't infer from file names or assume common patterns
2. **Verify dependencies** - check imports, configuration files, and environment setup
3. **Validate paths and config** - ensure files, directories, and values actually exist
4. **Match existing patterns** - align with the project's actual coding style and architecture

## The No-Time-Estimates Policy
Time estimates from AI are unreliable and can create false expectations. 
Scope and complexity descriptions are more actionable.

Avoid false precision in effort predictions:
- Do not offer LOE, time estimates, or duration predictions
- Ignore any estimates in existing plans
- Avoid phrases like: "5 minutes", "a few hours", "quick", "should be fast"

Acceptable alternatives:
- Describe scope: "This involves 3 files and 2 API changes"
- Describe complexity: "This requires understanding the auth flow first"
- Describe dependencies: "This is blocked by X"

Only mention "quick-fix" or "quick-win" when the person explicitly asks.


# UX Philosophy

> "We do the work so the user doesn't have to."

The burden of effort shifts from user to system. 
Every interaction should feel effortless—not because the problem is simple, but because the complexity has been absorbed by the design.

The user experiences simplicity. We've hidden the machinery.

---

## What This Philosophy Means

### Absorbing Complexity
You take on the hard thinking, edge cases, and technical burden so the interface feels effortless. The work you do is invisible; the user only sees the result.

### Anticipating, Not Asking
Instead of presenting options and asking "what do you want?", we predict intent. 
Smart defaults, contextual actions, auto-saving.
The system just *does* the right thing.

### Eliminating Decisions
Every choice you force on a user is work. 
Your job is to reduce those decisions to only the ones that truly matter to them.

### Front-Loading Effort
The value comes from us spending time solving a problem once so 10,000 users never encounter it. 
The ROI is in the invisibility of the work.

### Graceful Handling
Errors, edge cases, loading states, permissions.
You handle these so users never have to troubleshoot or wonder what went wrong.

### In Practice:

#### State & Memory
- Remember where they left off
- Persist preferences without asking
- Never lose user work
- Auto-save continuously
- Undo instead of "Are you sure?"

#### Feedback & Errors
- Status and errors appear contextual to the action
- Constrain inputs so invalid states are impossible
- Disable instead of error after the fact
- Inline validation as they type, not on submit
- Show what went wrong and how to fix it, in place

#### Progressive Disclosure
- Show basics first, reveal advanced when needed
- Hide what's not relevant to current context
- Expand complexity on demand, not by default

#### Sensible Defaults
- Pre-fill with likely values
- Suggest based on recent actions or patterns
- Name things automatically (e.g., "Untitled Document 3")
- Select the most common option by default

#### Performance as UX
- Optimistic UI—assume success, rollback on failure
- Load content progressively, not all-or-nothing
- Background sync, not blocking saves
- Perceived speed matters as much as actual speed

#### Reduce Mode-Switching
- Edit in place, not in modals
- Inline actions over navigation
- Keep context visible during operations
- Avoid full-page transitions for single actions

#### Accessibility
- Input-agnostic: mouse, keyboard, touch parity
- System adapts to user preferences (motion, contrast, size)
- Screen reader compatible by default

#### Error Prevention
- Make the right thing easy and the wrong thing hard
- Gray out unavailable actions, don't hide them (tool-tip explains what's required for activation)
- Validate as they go, not at the end
- Confirm destructive actions with undo, not dialogs

### That means:
**NO Toast notifications** 
- forces context-switching to read status
**NO "Are you sure?" dialogs** 
- shifts responsibility instead of providing undo
**NO Auto-correct** 
- assumes system knows better than user
**NO Pagination for small datasets < 100 items**
- makes user work to see their data
**NO Required fields without indication**
- errors discovered after the fact
**NO Silent logout on inactivity**
- loses work and context without warning
**NO Console-only errors**
- user has no idea what went wrong


# Agentic Architecture

> "Skills provide capability. Agents provide isolation. Commands provide orchestration."

All agentic work in this project follows a three-layer composable architecture. Each layer has one job and delegates down. Every layer is independently testable, and they compose upward.

```
┌──────────────────────────────────────────────────────────────┐
│  L3 — COMMAND (Orchestrate)          .claude/commands/       │
│  Discover work, fan out agents, aggregate results            │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  Agent 1 │  │  Agent 2 │  │  Agent 3 │  ...              │
│  │  Task A  │  │  Task B  │  │  Task C  │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
│       │              │              │                        │
│  ┌────▼──────────────▼──────────────▼─────────────────────┐  │
│  │  L2 — AGENT (Scale)             .claude/agents/        │  │
│  │  Receive scoped task → invoke skill → enforce output   │  │
│  │  contract → report structured results                  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  L1 — SKILL (Capability)     .claude/skills/     │  │  │
│  │  │  Domain logic, tool invocation, raw capability   │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Layer 1 — Skills (Capability)

Skills are the foundational layer. They encapsulate domain logic and tool invocation.

**Location:** `.claude/skills/<name>/SKILL.md`

**Rules:**
- A skill does one thing well — context analysis, planning CRUD, browser automation, wireframe generation
- Skills are invoked directly (by users or agents) via `/skill-name`
- Skills MUST define an **Output Contract** section specifying the structured format callers can expect
- Skills contain no orchestration logic — they don't spawn agents or fan out work
- Skills are stateless between invocations unless they explicitly persist to a store (Koji, filesystem)

**Output Contract Example:**
```markdown
## Output Contract

Returns structured markdown:
- **Status line:** `✅ SUCCESS` or `❌ FAILURE`
- **Summary:** 2-3 sentence description of what was done
- **Findings table:** `| # | Finding | Severity | File |`
- **Metrics:** key-value pairs relevant to the analysis
```

## Layer 2 — Agents (Scale)

Agents are thin wrappers around skills that provide isolation, structured reporting, and parallel execution.

**Location:** `.claude/agents/<name>.md`

**Rules:**
- An agent's only job: receive a scoped task, invoke the skill, enforce the output contract, report results
- Agents are thin — typically under 50 lines of markdown config. No business logic.
- Agents MUST return the output format defined in their Report section — this is what makes aggregation possible at L3
- Agents handle their own setup and teardown (create directories, open sessions, close sessions)
- On failure, agents capture diagnostic context (console errors, stack traces) and report structured failure — they do not retry or escalate
- Multiple agent instances can run in parallel when the skill supports it

**Agent Frontmatter:**
```yaml
---
name: <agent-name>
description: <when to use, keywords>
model: <sonnet|opus|haiku>
skills:
  - <skill-name>
---
```

**Agent Structure:**
```markdown
# <Agent Name>
## Purpose        — one sentence role definition
## Variables      — configurable inputs with defaults
## Workflow       — numbered steps: setup → execute → teardown → report
## Report         — exact output format (success and failure variants)
```

## Layer 3 — Commands (Orchestration)

Commands discover work, fan out agents in parallel, collect results, and aggregate reports.

**Location:** `.claude/commands/<name>.md`

**Rules:**
- Commands orchestrate — they do NOT execute domain logic directly
- Commands use TeamCreate/Task to spawn agents in parallel when work is parallelizable
- Commands discover work dynamically (glob for YAML, query the planning hierarchy, scan directories)
- Commands aggregate agent reports into summary tables with overall pass/fail status
- Commands handle agent timeouts and partial failures gracefully — one agent failing does not abort the run
- Commands clean up after themselves (TeamDelete, shutdown requests)

**Command Phases:**
1. **Discover** — find the work items (files, stories, entities, dimensions)
2. **Spawn** — create team, create tasks, launch agents in parallel
3. **Collect** — receive agent reports (auto-delivered via messages), parse results
4. **Report** — aggregate into summary markdown with status, table, and failure details

## When to Use Each Layer

| Scenario | Layer | Example |
|----------|-------|---------|
| Run a single analysis or action | L1 Skill | `/repo-review` for one dimension |
| Execute a scoped task with structured output | L2 Agent | `review-agent` runs security analysis, returns findings table |
| Fan out parallel work and aggregate | L3 Command | `/full-review` spawns 9 review agents, collects all findings |
| Direct user interaction, ad-hoc | L1 Skill | `/planning product create "X"` |
| CI or repeatable workflow | L3 Command | `/ui-review` discovers YAML stories, validates all in parallel |

## Composability Principle

Each layer is independently testable:
- Test a skill directly: `/context-kit-yaml`
- Spawn a single agent: `Task tool → subagent_type: review-agent`
- Run full orchestration: `/full-review`

Layers delegate down, never sideways or up. A command never calls another command. An agent never spawns another agent. A skill never orchestrates agents.
