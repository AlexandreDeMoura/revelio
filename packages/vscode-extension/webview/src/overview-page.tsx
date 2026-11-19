// The Overview: the app in plain words. How many Flows are written and how many are still to
// write, what the last commit changed, what to write next, and every Area with its Flows, each
// of which opens its Flow page.
//
// See every change, like the toolbar's search and Changes, does nothing yet: it waits for the
// Changes page.
import { useEffect, useState, type ReactNode } from "react";
import { AppIcon, ArrowRight, Chat, Check, ChevronRight, Commit, FlowMark, ReadAgain, ToWrite, ToWriteMark } from "./icons";
import { plural } from "./text";
import { ago } from "./to-flow";
import type { Overview, OverviewArea } from "./to-overview";
import { Toolbar } from "./toolbar";

export type OverviewActions = {
  openFlow(id: string): void;
  // Shows what this commit changed.
  openCommit(sha: string): void;
  // Asks the extension for the knowledge base again.
  readAgain(): void;
  // Puts in the agent's chat a request to write the Flows to write, or the one named.
  askToWrite(flowToWrite?: string): void;
};

export function OverviewPage({
  overview,
  readAt,
  actions,
}: {
  overview: Overview;
  // When the extension last sent the knowledge base, in ms.
  readAt: number;
  actions: OverviewActions;
}) {
  const { app, written, toWrite } = overview;
  const now = useNow();

  return (
    <div className="overview-page">
      <Toolbar
        crumbs={
          <>
            <span className="crumb">
              <AppIcon />
              {app}
            </span>
            <ChevronRight size={14} className="crumb-sep" />
            <span className="crumb" aria-current="page">
              Overview
            </span>
          </>
        }
      />
      <main className="overview">
        <header className="overview-header">
          <p className="overview-eyebrow">Your app, in plain words</p>
          <h1>{app}</h1>
          <p className="overview-summary">
            {written > 0 ? (
              <>
                <strong>{plural(written, "Flow")}</strong> {written === 1 ? "is" : "are"} written.
              </>
            ) : (
              "No Flow is written yet."
            )}
            {toWrite > 0 && (
              <>
                {" "}
                <strong>{written > 0 ? `${toWrite} more` : toWrite}</strong> {toWrite === 1 ? "is" : "are"} waiting to be written.
              </>
            )}
          </p>
          {overview.uncommitted > 0 && (
            <p className="overview-summary">
              <strong className="uncommitted">{overview.uncommitted}</strong> changed on your computer since the last commit.
            </p>
          )}
          <Progress written={written} total={written + toWrite} />
          <p className="overview-read">
            <span className="overview-read-dot" aria-hidden="true" />
            Knowledge base read {ago(new Date(readAt).toISOString(), now)}
            <span aria-hidden="true">·</span>
            <button type="button" className="link overview-read-again" onClick={actions.readAgain}>
              <ReadAgain size={14} />
              Read it again
            </button>
          </p>
        </header>

        {(overview.lastCommit || toWrite > 0) && (
          <div className="overview-cards">
            {overview.lastCommit && <LastCommit overview={overview} actions={actions} />}
            {toWrite > 0 && <StillToWrite overview={overview} actions={actions} />}
          </div>
        )}

        <Areas overview={overview} onOpenFlow={actions.openFlow} />
        <Words examples={overview.areaExamples} />
      </main>
    </div>
  );
}

// Now, in ms, again every minute, so how long ago something was stays true.
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// One segment per Flow, written or to write.
function Progress({ written, total }: { written: number; total: number }) {
  return (
    <div role="img" aria-label={`${written} of ${plural(total, "Flow")} written`} className="overview-progress">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < written ? "written" : ""} />
      ))}
    </div>
  );
}

function LastCommit({ overview, actions }: { overview: Overview; actions: OverviewActions }) {
  const commit = overview.lastCommit!;
  return (
    <section aria-label="In the last commit" className="overview-card">
      <h2>
        <Commit className="muted" />
        In the last commit
      </h2>
      <p className="overview-commit">
        <button type="button" className="link mono" title={commit.sha} onClick={() => actions.openCommit(commit.sha)}>
          {commit.short}
        </button>{" "}
        “{commit.subject}” · {commit.ago}
      </p>
      <p className="overview-card-text">
        {commit.flows.length === 0 ? (
          "It changed no Flow."
        ) : (
          <>
            It changed{" "}
            {joined(
              commit.flows.map((flow) => (
                <button key={flow.id} type="button" className="link" onClick={() => actions.openFlow(flow.id)}>
                  {flow.name}
                </button>
              )),
            )}
            .
          </>
        )}
      </p>
      <button type="button" className="link overview-card-foot">
        See every change
        <ArrowRight size={14} />
      </button>
    </section>
  );
}

function StillToWrite({ overview, actions }: { overview: Overview; actions: OverviewActions }) {
  const [handed, setHanded] = useState(false);
  const perArea = overview.areas.filter((area) => area.toWrite > 0).map((area) => `${area.toWrite} in ${area.name}`);
  // The Flows to write that written Flows wait for come first: the most waited for, at most three.
  const { waited } = overview;
  const named: ReactNode[] = waited.slice(0, 3).map((entry) => (
    <button
      key={entry.id}
      type="button"
      className="link overview-to-write"
      onClick={() => {
        actions.askToWrite(entry.name);
        setHanded(true);
      }}
    >
      {entry.name}
    </button>
  ));
  if (waited.length > 3) named.push(plural(waited.length - 3, "other"));
  const many = waited.length > 1 || (waited[0]?.dependents ?? 0) > 1;

  return (
    <section aria-label="Still to write" className="overview-card">
      <h2>
        <ToWrite className="muted" />
        Still to write
      </h2>
      <p className="overview-card-text">
        {perArea.join(", ")}.
        {waited.length > 0 && (
          <>
            {" "}
            Start with {joined(named)}: {many ? "written Flows already depend" : "a written Flow already depends"} on{" "}
            {waited.length > 1 ? "them" : "it"}.
          </>
        )}
      </p>
      {handed ? (
        <p className="overview-card-foot overview-handed">
          <Check size={14} />
          Handed to the agent: send it from the chat. New Flows show up here as soon as they are saved.
        </p>
      ) : (
        <div className="overview-card-foot overview-write">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              actions.askToWrite();
              setHanded(true);
            }}
          >
            <Chat size={14} />
            Write them with the agent
          </button>
          <span className="muted">
            Puts <code>/map-the-app</code> in the agent's chat, for you to send.
          </span>
        </div>
      )}
    </section>
  );
}

function Areas({ overview, onOpenFlow }: { overview: Overview; onOpenFlow: (id: string) => void }) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setClosed((was) => {
      const now = new Set(was);
      if (!now.delete(id)) now.add(id);
      return now;
    });
  const { areas } = overview;

  return (
    <section aria-labelledby="areas-title" className="overview-areas">
      <div className="overview-areas-head">
        <h2 id="areas-title">Areas</h2>
        <span className="muted">
          {plural(areas.length, "Area")} · {plural(overview.written + overview.toWrite, "Flow")}
        </span>
      </div>
      {areas.map((area) => (
        <AreaRow key={area.id} area={area} open={!closed.has(area.id)} onToggle={() => toggle(area.id)} onOpenFlow={onOpenFlow} />
      ))}
    </section>
  );
}

function AreaRow({
  area,
  open,
  onToggle,
  onOpenFlow,
}: {
  area: OverviewArea;
  open: boolean;
  onToggle: () => void;
  onOpenFlow: (id: string) => void;
}) {
  const meta = area.toWrite > 0 ? `${area.flows.length} written · ${area.toWrite} to write` : `${area.flows.length} written`;
  return (
    <div className="overview-area">
      <button type="button" className="overview-area-toggle" aria-expanded={open} onClick={onToggle}>
        <ChevronRight className="chevron muted" />
        <span className="overview-area-name">{area.name}</span>
        <span className="overview-area-meta">{meta}</span>
      </button>
      {open && (area.flows.length > 0 || area.toWrite > 0) && (
        <ul className="overview-flows">
          {area.flows.map((flow) => (
            <li key={flow.id}>
              <button type="button" className="overview-flow" onClick={() => onOpenFlow(flow.id)}>
                <FlowMark size={14} className="muted" />
                <span className="overview-flow-name">{flow.name}</span>
                <span className="overview-flow-actor">{flow.actor}</span>
                <ChevronRight size={14} className="muted" />
              </button>
            </li>
          ))}
          {area.toWrite > 0 && (
            <li className="overview-flow to-write">
              <ToWriteMark size={14} />
              <span>{plural(area.toWrite, "Flow")} still to write</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// The words of the page, for a Builder new to them.
function Words({ examples }: { examples: string[] }) {
  const such = examples.length ? `, such as ${examples.join(" or ")}` : "";
  const words: [string, string][] = [
    ["Area", `A region of your app that groups Flows${such}.`],
    ["Flow", "Something a person does in your app, written step by step."],
    ["Step", "One moment of a Flow: what the person does, what they see, and what the app does behind the scenes."],
    ["Variant", "A way a Flow can go differently from its main path, such as the phone being offline."],
    ["Part", "A piece of your app that a Step relies on, with where it lives in the code."],
  ];
  return (
    <details className="overview-words">
      <summary>Get to know the words</summary>
      <dl>
        {words.map(([word, means]) => (
          <div key={word}>
            <dt>{word}</dt>
            <dd>{means}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

// "a", "a and b", "a, b and c".
function joined(items: ReactNode[]): ReactNode[] {
  return items.flatMap((item, i) => [i === 0 ? "" : i === items.length - 1 ? " and " : ", ", item]);
}
