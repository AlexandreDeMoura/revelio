// Check by hand: the Manual QA Check of one path, a row per QA Step. The current QA Step is
// open, to record its QA Result and a note; picking a result moves on to the next QA Step
// not checked. Once every QA Step has a result, the page says so and offers the next path.
import { useState, type ReactNode } from "react";
import type { QaResult, QaState } from "../../src/messages";
import type { Path, QaStep } from "./flow";
import { ArrowRight, Chat, Check, Checklist, Cross, Dash, StartOver, Terminal } from "./icons";
import { InlineText, plural } from "./text";
import { ago, type FailedQaStep } from "./to-flow";

export type CheckActions = {
  record(step: string, state: QaState, note: string): void;
  note(step: string, note: string): void;
  // Sets every QA Step of the path back to not checked.
  reset(): void;
  askToFix(failed: FailedQaStep[]): void;
  openTerminal(): void;
};

const states: QaState[] = ["passed", "failed", "could-not-perform"];
const label: Record<QaState, string> = { passed: "Passed", failed: "Failed", "could-not-perform": "Could not perform" };
const mark: Record<QaState, (size: number) => ReactNode> = {
  passed: (size) => <Check size={size} />,
  failed: (size) => <Cross size={size} />,
  "could-not-perform": (size) => <Dash size={size} />,
};

// The QA Result of a QA Step, from the path's results by QA Step id.
export function resultOf(results: Record<string, QaResult>, qaStep: QaStep): QaResult | undefined {
  return qaStep.id !== undefined && Object.hasOwn(results, qaStep.id) ? results[qaStep.id] : undefined;
}

// How many of the path's QA Steps have each result, and how many are not checked.
export function tally(path: Path, results: Record<string, QaResult>) {
  const count = (state: QaState) => path.qa.steps.filter((qaStep) => resultOf(results, qaStep)?.state === state).length;
  const passed = count("passed");
  const failed = count("failed");
  const couldNot = count("could-not-perform");
  return { passed, failed, couldNot, left: path.qa.steps.length - passed - failed - couldNot };
}

export function CheckByHand({
  path,
  results,
  recordable,
  next,
  actions,
  onChoosePath,
}: {
  path: Path;
  // The path's QA Results, by QA Step id.
  results: Record<string, QaResult>;
  // False when results cannot be recorded: outside a git repo, or in one with no commit.
  recordable: boolean;
  // The path to check after this one, if one is left.
  next?: Path;
  actions: CheckActions;
  onChoosePath: (id: string) => void;
}) {
  const { setup, steps } = path.qa;
  const t = tally(path, results);
  const checked = steps.length - t.left;
  const [chosen, setChosen] = useState<number>();
  const [prepared, setPrepared] = useState(() => setup.map(() => checked > 0));
  // Notes typed and not saved yet, by the QA Step's index.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  // The failed QA Steps handed to the agent, by index.
  const [asked, setAsked] = useState<Set<number>>(() => new Set());

  const result = (i: number) => resultOf(results, steps[i]!);
  // The QA Step open: the one clicked or moved to, else the first not checked. -1 is none.
  const current = chosen ?? steps.findIndex((qaStep) => !resultOf(results, qaStep));
  const noteOf = (i: number) => drafts[i] ?? result(i)?.note ?? "";

  const record = (i: number, state: QaState) => {
    const id = steps[i]!.id;
    if (id === undefined) return;
    actions.record(id, state, noteOf(i));
    const open = (j: number) => j !== i && !result(j);
    const after = steps.findIndex((_, j) => j > i && open(j));
    setChosen(after >= 0 ? after : steps.findIndex((_, j) => open(j)));
    setPrepared((was) => was.map(() => true));
    setDrafts(({ [i]: _, ...rest }) => rest);
  };
  const saveNote = (i: number) => {
    const id = steps[i]!.id;
    const draft = drafts[i];
    if (id !== undefined && draft !== undefined && result(i) && draft !== result(i)!.note) actions.note(id, draft);
  };
  const failedSteps = (indexes: number[]) =>
    indexes.map((i) => ({ do: steps[i]!.do, expect: steps[i]!.expect, note: result(i)?.note ?? "" }));
  const askToFix = (indexes: number[]) => {
    actions.askToFix(failedSteps(indexes));
    setAsked((was) => new Set([...was, ...indexes]));
  };

  const startOver = () => {
    actions.reset();
    setChosen(undefined);
    setPrepared(setup.map(() => false));
    setDrafts({});
    setAsked(new Set());
  };

  const counts = [
    ...(t.passed ? [`${t.passed} passed`] : []),
    ...(t.failed ? [`${t.failed} failed`] : []),
    ...(t.couldNot ? [`${t.couldNot} could not be performed`] : []),
  ];
  const progress = checked === 0 ? `${plural(steps.length, "QA Step")} to check` : [...counts, ...(t.left ? [`${t.left} to check`] : [])].join(" · ");
  const allDone = steps.length > 0 && t.left === 0;
  const unasked = steps.map((_, i) => i).filter((i) => result(i)?.state === "failed" && !asked.has(i));
  const latest = steps.map((_, i) => result(i)?.date ?? "").sort().at(-1);

  return (
    <div className="check">
      <div className="check-progress">
        <div className="check-heading">
          <span className="check-title">Manual QA Check · {path.name}</span>
          <span className="muted">{progress}</span>
          {checked > 0 && recordable && (
            <button type="button" className="link start-over" onClick={startOver}>
              <StartOver size={14} />
              Start over
            </button>
          )}
        </div>
        <div role="img" aria-label={progress} className="check-bar">
          {steps.map((qaStep, i) => (
            <span key={i} className={`check-bar-part ${resultOf(results, qaStep)?.state ?? (i === current ? "current" : "")}`} />
          ))}
        </div>
      </div>

      {!recordable && <p className="check-warning">Results cannot be recorded yet: they need a git repo with at least one commit.</p>}

      {allDone && (
        <div className="check-done">
          <div className="check-done-text">
            <Checklist size={20} />
            <div>
              <p className="check-done-title">{path.name} checked</p>
              <p className="muted">
                {counts.join(" · ")}
                {latest && ` · ${ago(latest, Date.now())}`}. The results stay on this machine.
              </p>
            </div>
          </div>
          <div className="check-done-actions">
            {unasked.length > 0 && (
              <button type="button" className="primary-button" onClick={() => askToFix(unasked)}>
                <Chat size={14} />
                {unasked.length === 1 ? "Ask the agent to fix the failed QA Step" : "Ask the agent to fix the failed QA Steps"}
              </button>
            )}
            {next && (
              <button type="button" className="secondary-button" onClick={() => onChoosePath(next.id)}>
                Check the next path: {next.name}
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {!allDone && (
        <div className="check-prepare">
          <span className="check-prepare-title">Prepare · {setup.length ? plural(setup.length, "thing") : "nothing to set up"}</span>
          {setup.length > 0 && (
            <div className="check-prepare-things">
              {setup.map((thing, i) => (
                <label key={i} className={`check-prepare-thing ${prepared[i] ? "done" : ""}`}>
                  <input
                    type="checkbox"
                    checked={prepared[i] ?? false}
                    onChange={() => setPrepared((was) => was.map((on, j) => (j === i ? !on : on)))}
                  />
                  <span>
                    <InlineText text={thing} />
                  </span>
                </label>
              ))}
            </div>
          )}
          <button type="button" className="secondary-button" onClick={actions.openTerminal}>
            <Terminal size={14} />
            Open a terminal here
          </button>
        </div>
      )}

      {steps.length === 0 ? (
        <p className="muted">This path has no QA Step to check.</p>
      ) : (
        <ol aria-label="QA Steps" className="qa-steps">
          {steps.map((qaStep, i) => {
            const shown = result(i);
            const state = shown?.state;
            if (i === current)
              return (
                <li key={i} className="qa-step current">
                  <span className="qa-mark">{i + 1}</span>
                  <div className="qa-body">
                    <span className="qa-label">Do</span>
                    <p className="qa-do">
                      <InlineText text={qaStep.do} />
                    </p>
                    <span className="qa-label expect">Expect</span>
                    <p className="qa-expect">
                      <InlineText text={qaStep.expect} />
                    </p>
                    {qaStep.id === undefined ? (
                      <p className="check-warning">This QA Step has no id, so no result can be recorded on it.</p>
                    ) : (
                      recordable && (
                        <>
                          <div role="group" aria-label="Result" className="qa-results">
                            {states.map((each) => (
                              <button
                                key={each}
                                type="button"
                                className={`qa-result ${each}`}
                                aria-pressed={state === each}
                                onClick={() => record(i, each)}
                              >
                                {mark[each](16)}
                                {label[each]}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            className="qa-note-input"
                            aria-label="Note about what you saw"
                            placeholder="Note about what you saw"
                            value={noteOf(i)}
                            onChange={(event) => setDrafts((was) => ({ ...was, [i]: event.target.value }))}
                            onBlur={() => saveNote(i)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
                            }}
                          />
                          <span className="qa-hint">Picking a result saves it and moves to the next QA Step.</span>
                        </>
                      )
                    )}
                  </div>
                </li>
              );
            return (
              <li key={i} className={`qa-step ${state ?? ""}`}>
                <span className={`qa-mark ${state ?? ""}`}>{state ? mark[state](14) : i + 1}</span>
                <div className="qa-row-text">
                  <button type="button" className="qa-open" onClick={() => setChosen(i)}>
                    <InlineText text={qaStep.do} />
                  </button>
                  {shown?.note && <p className="qa-note">“{shown.note}”</p>}
                  {state === "failed" &&
                    (asked.has(i) ? (
                      <span className="qa-asked">
                        <Check size={14} />
                        Handed to the agent, with what you expected and your note
                      </span>
                    ) : (
                      <button type="button" className="link ask-fix" onClick={() => askToFix([i])}>
                        <Chat size={14} />
                        Ask the agent to fix this
                      </button>
                    ))}
                </div>
                <span className={`qa-status ${state ?? ""}`}>{state ? label[state] : "Not checked"}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
