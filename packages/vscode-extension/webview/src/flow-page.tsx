// The Flow page: what a Flow is for, who carries it out, and its main path Step by Step,
// each Step's Parts opening onto where they live in the code.
//
// The path picker and the Variant links show a Variant's Steps instead. Check by hand, which
// the C key opens and the R key leaves, shows the Manual QA Check of the path chosen.
//
// The app's name in the breadcrumb and the Overview button open the Overview. The search,
// Changes and the breadcrumb menus do nothing yet: they wait for the pages they open.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { QaResult, QaState } from "../../src/messages";
import { CheckByHand, tally } from "./check-by-hand";
import type { Anchor, Flow, Part, Path, Step } from "./flow";
import {
  AppIcon,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Chat,
  Check,
  ChevronDown,
  ChevronRight,
  Commit,
  File,
  Fork,
  Lock,
  OpenBeside,
} from "./icons";
import { InlineText, plural } from "./text";
import type { FailedQaStep } from "./to-flow";
import { Toolbar } from "./toolbar";

type OpenPart = { step: number; part: string } | null;

// Another Flow the page can go to.
export type FlowLink = { name: string; open: () => void };

// What the page's buttons ask for. `at` is an Anchor's `path#Symbol`.
export type FlowActions = {
  openFlow(id: string): void;
  openOverview(): void;
  openFlowFile(): void;
  openAnchor(at: string): void;
  askAbout(part: Part): void;
  // Shows what the commit that last changed the Flow changed.
  openLastChange(): void;
  recordQaResult(path: string, step: string, state: QaState, note: string): void;
  noteQaResult(path: string, step: string, note: string): void;
  // Sets every QA Step of the path back to not checked.
  resetQaResults(path: string): void;
  askToFix(path: Path, failed: FailedQaStep[]): void;
  openTerminal(): void;
};

type Tab = "read" | "check";

export function FlowPage({
  flow,
  actions,
  previous,
  next,
  results = {},
  recordable = true,
}: {
  flow: Flow;
  actions: FlowActions;
  previous?: FlowLink;
  next?: FlowLink;
  // The Builder's QA Results on the Flow, by path id, then QA Step id.
  results?: Record<string, Record<string, QaResult>>;
  // False when results cannot be recorded: outside a git repo, or in one with no commit.
  recordable?: boolean;
}) {
  const [open, setOpen] = useState<OpenPart>(null);
  const [pathId, setPathId] = useState("main");
  const [tab, setTab] = useState<Tab>("read");
  useTabKeys(setTab);
  const toggle = (step: number, part: string) =>
    setOpen((current) => (current?.step === step && current.part === part ? null : { step, part }));
  // The path chosen, while the Flow still has it, else the main path.
  const path = flow.paths.find((candidate) => candidate.id === pathId) ?? flow.paths[0];
  const choosePath = (id: string) => {
    setPathId(id);
    setOpen(null);
  };
  const onPath = (of: Path) => results[of.id] ?? {};
  const checked = tally(path, onPath(path));

  return (
    <div className="flow-page">
      <FlowToolbar flow={flow} previous={previous} next={next} onOverview={actions.openOverview} />
      <main className="flow">
        <Header flow={flow} actions={actions} />
        {tab === "read" && <About flow={flow} actions={actions} />}

        <div role="tablist" aria-label="How to use this Flow" className="tabs">
          <button
            type="button"
            role="tab"
            id="tab-read"
            aria-selected={tab === "read"}
            aria-controls="panel"
            className="tab"
            onClick={() => setTab("read")}
          >
            Read the Flow <kbd>R</kbd>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-check"
            aria-selected={tab === "check"}
            aria-controls="panel"
            className="tab"
            onClick={() => setTab("check")}
          >
            Check by hand <kbd>C</kbd>
          </button>
          <span className="tabs-meta">
            {tab === "read" ? pathMeta(path) : `${checked.passed} of ${plural(path.qa.steps.length, "QA Step")} passed`}
          </span>
        </div>

        <div role="tabpanel" id="panel" aria-labelledby={tab === "read" ? "tab-read" : "tab-check"}>
          <div className="path-bar">
            <PathPicker paths={flow.paths} shown={path} onChoose={choosePath} />
            {tab === "check" && (
              <span className="results-stay">
                <Lock size={14} />
                Results stay on this machine, outside the repo
              </span>
            )}
          </div>

          {tab === "check" ? (
            <CheckByHand
              key={path.id}
              path={path}
              results={onPath(path)}
              recordable={recordable}
              next={nextPath(flow.paths, path, (of) => tally(of, onPath(of)).left)}
              onChoosePath={choosePath}
              actions={{
                record: (step, state, note) => actions.recordQaResult(path.id, step, state, note),
                note: (step, note) => actions.noteQaResult(path.id, step, note),
                reset: () => actions.resetQaResults(path.id),
                askToFix: (failed) => actions.askToFix(path, failed),
                openTerminal: actions.openTerminal,
              }}
            />
          ) : (
            <ReadTheFlow flow={flow} path={path} open={open} onToggle={toggle} onChoosePath={choosePath} actions={actions} />
          )}
        </div>
      </main>
    </div>
  );
}

// R reads the Flow and C checks it by hand, unless a note is being typed or a modifier is held.
function useTabKeys(setTab: (tab: Tab) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if ((event.target as Element | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
      const key = event.key.toLowerCase();
      if (key === "r") setTab("read");
      else if (key === "c") setTab("check");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setTab]);
}

// The path to check after this one: the next one with no QA Step checked, else the next one with
// a QA Step not checked. `left` counts a path's QA Steps not checked.
function nextPath(paths: Path[], path: Path, left: (path: Path) => number): Path | undefined {
  const at = paths.indexOf(path);
  const after = [...paths.slice(at + 1), ...paths.slice(0, at)].filter((other) => other.qa.steps.length > 0);
  return after.find((other) => left(other) === other.qa.steps.length) ?? after.find((other) => left(other) > 0);
}

// The Steps of the path chosen, with its outcome.
function ReadTheFlow({
  flow,
  path,
  open,
  onToggle,
  onChoosePath,
  actions,
}: {
  flow: Flow;
  path: Path;
  open: OpenPart;
  onToggle: (step: number, part: string) => void;
  onChoosePath: (id: string) => void;
  actions: FlowActions;
}) {
  return (
    <>

      {path.id !== "main" && path.divergesAt === undefined && (
        <p className="variant-banner">
          <span className="banner-label">Variant</span>
          <span>{path.when}</span>
          <span className="uncommitted">It leaves at a Step the main path does not have.</span>
        </p>
      )}

      <ol aria-label="Steps" className="steps">
        {path.steps.map((step, i) => (
          <StepRow
            key={`${path.id}-${i}`}
            flow={flow}
            path={path}
            step={step}
            index={i}
            openPart={open?.step === i ? open.part : null}
            onToggle={(part) => onToggle(i, part)}
            onChoosePath={onChoosePath}
            actions={actions}
          />
        ))}
      </ol>

      <div className="line outcome">
        <span className="line-label">Outcome</span>
        <p>
          <InlineText text={path.outcome} />
        </p>
      </div>
    </>
  );
}

// Chooses the path the Steps follow: the main path, or one of the Variants, with when each is taken.
function PathPicker({ paths, shown, onChoose }: { paths: Path[]; shown: Path; onChoose: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const picker = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const variants = paths.length - 1;
  const isMain = shown.id === "main";

  // A click anywhere else closes the menu.
  useEffect(() => {
    if (!expanded) return;
    const away = (event: PointerEvent) => {
      if (!picker.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [expanded]);

  const close = () => {
    setExpanded(false);
    trigger.current?.focus();
  };
  const option = (path: Path) => {
    const selected = path.id === shown.id;
    return (
      <button
        key={path.id}
        type="button"
        className="path-option"
        aria-pressed={selected}
        onClick={() => {
          onChoose(path.id);
          close();
        }}
      >
        {path.id === "main" ? <ArrowDown className="muted" /> : <Fork className="muted" />}
        <span className="path-option-text">
          <span className="path-name">{path.name}</span>
          <span className="path-option-meta">{pathMeta(path)}</span>
        </span>
        <span className="path-option-check">{selected && <Check />}</span>
      </button>
    );
  };

  return (
    <div className="path-picker-wrap" ref={picker}>
      <button
        ref={trigger}
        type="button"
        className="path-picker"
        aria-label={`Choose a path. Now: ${isMain ? "Main path" : `Variant, ${shown.name}`}`}
        aria-expanded={expanded}
        aria-controls="path-menu"
        onClick={() => setExpanded((was) => !was)}
      >
        {isMain ? <ArrowDown className="muted" /> : <Fork className="muted" />}
        <span className="path-kind">{isMain ? "Main path" : "Variant"}</span>
        <span className="path-name path-shown">{isMain ? "Follow the main path" : shown.name}</span>
        {variants > 0 && <span className="count">{plural(variants, "Variant")}</span>}
        <ChevronDown className="chevron" />
      </button>
      {expanded && (
        <div
          id="path-menu"
          role="group"
          aria-label="Choose a path"
          className="path-menu"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <p className="path-heading">Main path</p>
          {option(paths[0]!)}
          {variants > 0 && (
            <>
              <p className="path-heading variants">
                Variants <span>{variants}</span>
              </p>
              {paths.slice(1).map(option)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// How many Steps a path has, and where a Variant leaves the main path.
function pathMeta(path: Path): string {
  const leaves = path.divergesAt === undefined ? "" : ` · leaves at Step ${path.divergesAt + 1}`;
  return `${plural(path.steps.length, "Step")}${leaves}`;
}

function FlowToolbar({
  flow,
  previous,
  next,
  onOverview,
}: {
  flow: Flow;
  previous?: FlowLink;
  next?: FlowLink;
  onOverview: () => void;
}) {
  return (
    <Toolbar
      onOverview={onOverview}
      crumbs={
        <>
          <button type="button" className="crumb" onClick={onOverview}>
            <AppIcon />
            {flow.app}
          </button>
          <ChevronRight size={14} className="crumb-sep" />
          <button type="button" className="crumb">
            {flow.area}
            <ChevronDown size={14} />
          </button>
          <ChevronRight size={14} className="crumb-sep" />
          <button type="button" className="crumb" aria-current="page">
            {flow.name}
            <ChevronDown size={14} />
          </button>
        </>
      }
    >
      <span aria-hidden="true" className="toolbar-divider" />
      <button
        type="button"
        className="icon-button"
        aria-label={previous ? `Previous Flow: ${previous.name}` : "Previous Flow"}
        title={previous?.name}
        disabled={!previous}
        onClick={previous?.open}
      >
        <ArrowLeft />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={next ? `Next Flow: ${next.name}` : "Next Flow"}
        title={next?.name}
        disabled={!next}
        onClick={next?.open}
      >
        <ArrowRight />
      </button>
    </Toolbar>
  );
}

function Header({ flow, actions }: { flow: Flow; actions: FlowActions }) {
  return (
    <header className="flow-header">
      <h1>{flow.name}</h1>
      <p className="goal">{flow.goal}</p>
      <div className="flow-meta">
        {flow.uncommitted && <span className="meta-item uncommitted">Changes not committed</span>}
        {flow.lastChange && (
          <span className="meta-item">
            <Commit />
            Last changed in
            <button
              type="button"
              className="link mono commit"
              title={flow.lastChange.subject}
              onClick={actions.openLastChange}
            >
              {flow.lastChange.sha}
            </button>
            · {flow.lastChange.ago}
          </span>
        )}
        <button type="button" className="link meta-item" onClick={actions.openFlowFile}>
          <File />
          Open the Flow file
        </button>
      </div>
    </header>
  );
}

function About({ flow, actions }: { flow: Flow; actions: FlowActions }) {
  return (
    <section aria-label="About this Flow" className="about">
      <div className="fact">
        <h2>Actor</h2>
        <p>
          <strong>{flow.actor.name}</strong> · {flow.actor.description}
        </p>
      </div>
      <div className="fact">
        <h2>Trigger</h2>
        <p>
          <InlineText text={flow.trigger} />
        </p>
      </div>
      {flow.preconditions.length > 0 && (
        <div className="fact">
          <h2>Before it starts</h2>
          <ul className="preconditions">
            {flow.preconditions.map((pre, i) => (
              <li key={i}>
                <InlineText text={pre.text} />
                {pre.flowId !== undefined ? (
                  <button type="button" className="flow-chip" onClick={() => actions.openFlow(pre.flowId!)}>
                    <ArrowRight size={14} />
                    {pre.flow}
                  </button>
                ) : (
                  pre.flow && (
                    <span className={`flow-chip ${pre.toWrite ? "to-write" : "missing"}`}>
                      {pre.toWrite ? `${pre.flow} · to write` : pre.flow}
                    </span>
                  )
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StepRow({
  flow,
  path,
  step,
  index,
  openPart,
  onToggle,
  onChoosePath,
  actions,
}: {
  flow: Flow;
  path: Path;
  step: Step;
  index: number;
  openPart: string | null;
  onToggle: (part: string) => void;
  onChoosePath: (id: string) => void;
  actions: FlowActions;
}) {
  // On the main path, the Variants that leave it at this Step.
  const leaving = path.id === "main" ? flow.paths.slice(1).filter((variant) => variant.divergesAt === index) : [];
  const leavesHere = path.id !== "main" && path.divergesAt === index;
  const part = openPart ? flow.parts[openPart] : undefined;

  return (
    <li className={`step ${step.shared ? "shared" : ""}`}>
      <span className="step-number">{index + 1}</span>
      <div className="step-body">
        {step.shared && (
          <p className="step-tags">
            <span className="tag">Same as main path</span>
          </p>
        )}
        {leavesHere && (
          <p className="step-tags">
            <span className="tag leaves">Leaves the main path</span>
            <span className="when">when {path.when}</span>
          </p>
        )}
        {step.does && (
          <Line label="Does" className="does">
            <InlineText text={step.does} />
          </Line>
        )}
        {step.sees && (
          <Line label="Sees" className="sees">
            <InlineText text={step.sees} />
          </Line>
        )}
        {step.system && (
          <Line label="System" className="system">
            <InlineText text={step.system} />
          </Line>
        )}

        {leaving.length > 0 && (
          <p className="leaving">
            <Fork size={14} />
            {leaving.length === 1 ? "A Variant leaves here:" : "Variants leave here:"}
            {leaving.map((variant, i) => (
              <span key={variant.id}>
                <button type="button" className="link" onClick={() => onChoosePath(variant.id)}>
                  {variant.name}
                </button>
                {i < leaving.length - 1 && ","}
              </span>
            ))}
          </p>
        )}

        {step.parts.length > 0 && (
          <div className="line parts-line">
            <span className="line-label">Parts</span>
            <div className="part-chips">
              {step.parts.map((id) => {
                const isOpen = id === openPart;
                return (
                  <button
                    key={id}
                    type="button"
                    className="part-chip"
                    aria-expanded={isOpen}
                    onClick={() => onToggle(id)}
                  >
                    {flow.parts[id]?.name ?? id}
                    <ChevronDown size={14} className="chevron" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {part && <PartPanel part={part} actions={actions} />}
      </div>
    </li>
  );
}

function Line({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return (
    <div className={`line ${className}`}>
      <span className="line-label">{label}</span>
      <p>{children}</p>
    </div>
  );
}

function PartPanel({ part, actions }: { part: Part; actions: FlowActions }) {
  return (
    <div className={`part-panel ${part.anchors.length ? "" : "alone"}`}>
      <div className="part-about">
        <h3>{part.name}</h3>
        <p>
          <InlineText text={part.is} />
        </p>
        {part.anchors.length > 0 && (
          <button type="button" className="link ask" onClick={() => actions.askAbout(part)}>
            <Chat size={14} />
            Ask the agent about this Part
          </button>
        )}
      </div>
      {part.anchors.length > 0 && (
        <div className="part-code">
          <p className="part-code-title">Where it lives in the code</p>
          <ul>
            {part.anchors.map((anchor) => (
              <li key={anchor.at}>
                <AnchorRow anchor={anchor} onOpen={() => actions.openAnchor(anchor.at)} />
              </li>
            ))}
          </ul>
          <p className="part-code-note">Opens the file beside this view, at that spot.</p>
        </div>
      )}
    </div>
  );
}

function AnchorRow({ anchor, onOpen }: { anchor: Anchor; onOpen: () => void }) {
  const [file, symbol] = anchor.at.split("#");
  return (
    <button type="button" className="anchor" onClick={onOpen}>
      <span className="anchor-text">
        <span className="anchor-label">{anchor.label}</span>
        <span className="anchor-at mono">
          <span className="anchor-file">{file}</span>
          {symbol && `#${symbol}`} · {anchor.side}
        </span>
      </span>
      <OpenBeside className="muted" />
    </button>
  );
}
