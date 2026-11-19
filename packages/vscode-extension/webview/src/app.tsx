import { useEffect, useState } from "react";
import type { FlowChange, KnowledgeBase } from "../../src/messages";
import { FlowPage, type FlowActions, type FlowLink } from "./flow-page";
import type { Host } from "./host";
import { askPrompt, flowOrder, toFlow } from "./to-flow";

type Received = { knowledgeBase: KnowledgeBase } | { error: string } | undefined;

// The Revelio view: the Flow page of one Flow of the knowledge base the extension sends,
// shown again each time the extension sends it.
export function App({ host }: { host: Host }) {
  const [received, setReceived] = useState<Received>();
  const [changes, setChanges] = useState<Record<string, FlowChange> | null>();
  const [chosen, setChosen] = useState<string | undefined>(() => host.savedFlow());

  useEffect(() => {
    const stop = host.onMessage((message) => {
      if (message.type === "knowledgeBase") setReceived({ knowledgeBase: message.knowledgeBase });
      else if (message.type === "changes") setChanges(message.flows);
      else setReceived({ error: message.message });
    });
    host.post({ type: "ready" });
    return stop;
  }, [host]);

  if (!received) return <Notice>Reading the knowledge base…</Notice>;
  if ("error" in received) return <Notice>{received.error}</Notice>;

  const kb = received.knowledgeBase;
  const order = flowOrder(kb);
  // The Flow chosen, while the knowledge base still has it, else the first.
  const id = chosen !== undefined && order.includes(chosen) ? chosen : order[0];
  const flow = id === undefined ? undefined : toFlow(kb, id, changes);
  if (id === undefined || !flow) return <Notice>No Flow is written yet.</Notice>;

  const openFlow = (other: string) => {
    setChosen(other);
    host.saveFlow(other);
  };
  const at = order.indexOf(id);
  const link = (other: string | undefined): FlowLink | undefined =>
    other === undefined ? undefined : { name: kb.flows[other]?.name ?? other, open: () => openFlow(other) };
  const actions: FlowActions = {
    openFlow,
    openFlowFile: () => host.post({ type: "openFlowFile", flow: id }),
    openAnchor: (anchor) => host.post({ type: "openAnchor", at: anchor }),
    askAbout: (part) => host.post({ type: "askAgent", prompt: askPrompt(flow, part) }),
  };

  // Keyed by Flow, so a Part open on one Flow is not open on the next.
  return (
    <FlowPage key={id} flow={flow} actions={actions} previous={link(order[at - 1])} next={link(order[at + 1])} />
  );
}

function Notice({ children }: { children: string }) {
  return (
    <main className="notice">
      <p>{children}</p>
    </main>
  );
}
