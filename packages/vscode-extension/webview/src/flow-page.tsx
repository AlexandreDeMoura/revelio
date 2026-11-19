// The Flow page: what a Flow is for, who carries it out, and its main path Step by Step,
// each Step's Parts opening onto where they live in the code.
//
// The search, Overview, Changes, the breadcrumb menus, the path picker and the Variant links
// do nothing yet: they wait for the pages they open.
import { useState, type ReactNode } from "react";
import type { Anchor, Flow, Part, Step } from "./flow";
import {
  AppIcon,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Chat,
  ChevronDown,
  ChevronRight,
  Commit,
  File,
  Fork,
  GitBranch,
  Grid,
  OpenBeside,
  Search,
} from "./icons";

type OpenPart = { step: number; part: string } | null;

// Another Flow the page can go to.
export type FlowLink = { name: string; open: () => void };

// What the page's buttons ask for. `at` is an Anchor's `path#Symbol`.
export type FlowActions = {
  openFlow(id: string): void;
  openFlowFile(): void;
  openAnchor(at: string): void;
  askAbout(part: Part): void;
};

export function FlowPage({
  flow,
  actions,
  previous,
  next,
}: {
  flow: Flow;
  actions: FlowActions;
  previous?: FlowLink;
  next?: FlowLink;
}) {
  const [open, setOpen] = useState<OpenPart>(null);
  const toggle = (step: number, part: string) =>
    setOpen((current) => (current?.step === step && current.part === part ? null : { step, part }));

  return (
    <div className="flow-page">
      <Toolbar flow={flow} previous={previous} next={next} />
      <main className="flow">
        <Header flow={flow} actions={actions} />
        <About flow={flow} actions={actions} />

        <div role="tablist" aria-label="How to use this Flow" className="tabs">
          <button type="button" role="tab" id="tab-read" aria-selected="true" aria-controls="panel-read" className="tab">
            Read the Flow <kbd>R</kbd>
          </button>
          <button type="button" role="tab" aria-selected="false" disabled className="tab">
            Check by hand <kbd>C</kbd>
          </button>
          <span className="tabs-meta">{plural(flow.steps.length, "Step")}</span>
        </div>

        <div role="tabpanel" id="panel-read" aria-labelledby="tab-read">
          <div className="path-bar">
            <button type="button" className="path-picker">
              <ArrowDown className="muted" />
              <span className="path-name">Main path</span>
              <span className="muted">Follow the main path</span>
              {flow.variants.length > 0 && <span className="count">{plural(flow.variants.length, "Variant")}</span>}
              <ChevronDown />
            </button>
          </div>

          <ol aria-label="Steps" className="steps">
            {flow.steps.map((step, i) => (
              <StepRow
                key={i}
                flow={flow}
                step={step}
                index={i}
                openPart={open?.step === i ? open.part : null}
                onToggle={(part) => toggle(i, part)}
                actions={actions}
              />
            ))}
          </ol>
        </div>
      </main>
    </div>
  );
}

function Toolbar({ flow, previous, next }: { flow: Flow; previous?: FlowLink; next?: FlowLink }) {
  return (
    <div className="toolbar">
      <nav aria-label="Where you are" className="crumbs">
        <button type="button" className="crumb">
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
      </nav>
      <div className="toolbar-actions">
        <button type="button" className="icon-button" aria-label="Go to a Flow or Part">
          <Search />
        </button>
        <button type="button" className="toolbar-link">
          <Grid />
          Overview
        </button>
        <button type="button" className="toolbar-link">
          <GitBranch />
          Changes
        </button>
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
      </div>
    </div>
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
            <span className="mono commit" title={flow.lastChange.subject}>
              {flow.lastChange.sha}
            </span>
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
  step,
  index,
  openPart,
  onToggle,
  actions,
}: {
  flow: Flow;
  step: Step;
  index: number;
  openPart: string | null;
  onToggle: (part: string) => void;
  actions: FlowActions;
}) {
  const leaving = flow.variants.filter((variant) => variant.divergesAt === index);
  const part = openPart ? flow.parts[openPart] : undefined;

  return (
    <li className="step">
      <span className="step-number">{index + 1}</span>
      <div className="step-body">
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
              <span key={variant.name}>
                <button type="button" className="link">
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

// Text with code, an address or a label on screen marked between backticks.
function InlineText({ text }: { text: string }) {
  return text.split("`").map((piece, i) => (i % 2 === 1 ? <code key={i}>{piece}</code> : piece));
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
