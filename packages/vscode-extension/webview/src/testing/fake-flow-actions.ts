// Every action of the Flow page, recorded, for tests to render the page with. Only tests import it.
// A new action is added here once, and every test that renders the Flow page has it.
import { vi, type Mock } from "vitest";
import type { FlowActions } from "../flow-page";

export type FakeFlowActions = { [Action in keyof FlowActions]: Mock<FlowActions[Action]> };

export function fakeFlowActions(): FakeFlowActions {
  return {
    openFlow: vi.fn(),
    openOverview: vi.fn(),
    openFlowFile: vi.fn(),
    openAnchor: vi.fn(),
    askAbout: vi.fn(),
    openLastChange: vi.fn(),
    recordQaResult: vi.fn(),
    noteQaResult: vi.fn(),
    resetQaResults: vi.fn(),
    askToFix: vi.fn(),
    openTerminal: vi.fn(),
  };
}
