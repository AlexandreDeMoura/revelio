import type { Flow } from "./flow";

// A Flow of a made-up app, shown until the extension sends the knowledge base to the webview.
export const sampleFlow: Flow = {
  app: "pantry",
  area: "Grocery list",
  name: "Add an item to the list",
  goal: "Put something on the household's grocery list so nobody forgets it.",
  lastChange: { sha: "7c2e9a4", ago: "5 hours ago" },
  actor: { name: "Cook", description: "The person who plans the week's meals and does the shopping." },
  trigger: "The Cook taps `Add item` at the top of the grocery list.",
  preconditions: [
    { text: "The Cook has an account.", flow: "Sign up with an email" },
    { text: "The household has a list on `/list`." },
  ],
  parts: {
    "add-item-box": {
      name: "Add item box",
      is: "Reads what the Cook types, pulls out a quantity like `x2`, and refuses an empty item.",
      anchors: [
        { label: "The box at the top of the list", at: "src/list/AddItemBox.tsx#AddItemBox", side: "screen" },
        { label: "Pulling the quantity out of the text", at: "src/list/parseQuantity.ts#parseQuantity", side: "screen" },
        { label: "Refusing an item that is only spaces", at: "src/list/AddItemBox.tsx#rejectEmpty", side: "screen" },
      ],
    },
    "list-sync": {
      name: "List sync",
      is: "Sends each change to every phone in the household as soon as it is saved.",
      anchors: [],
    },
    "list-server": {
      name: "List server",
      is: "Keeps each household’s list and hands it to any phone that asks for it.",
      anchors: [],
    },
    "item-history": {
      name: "Item history",
      is: "Remembers who added each item and when, for “Added by … · just now”.",
      anchors: [],
    },
    "list-header": {
      name: "List header",
      is: "The top of the list: its name, the item count and the share button.",
      anchors: [],
    },
  },
  steps: [
    {
      does: "Types an item in the box at the top of the list, adding `x2` or `500 g` when more than one is needed.",
      sees: "The item appears at the top of the list, marked \"Added by you · just now\", and the box empties for the next one.",
      system: "Saves the item to the household's list, which sends it to every phone in the household.",
      parts: ["add-item-box", "list-sync"],
    },
    {
      does: "Opens the list on a second phone in the household.",
      sees: "The new item is at the top, marked \"Added by <member> · just now\", and the item count in the header goes up by one.",
      system:
        "The phone asks the server for the list. The server sends every item of the household's list, and marks the ones added since that phone last opened `/list`.",
      parts: ["list-sync", "list-server", "item-history", "list-header"],
    },
    { does: "Taps the item to change its quantity.", parts: [] },
    { does: "Closes the list. The item stays there for everyone.", parts: [] },
  ],
  variants: [
    { name: "The item is already on the list", divergesAt: 0 },
    { name: "The phone is offline", divergesAt: 1 },
    { name: "The item was removed meanwhile", divergesAt: 1 },
    { name: "The list cannot be loaded", divergesAt: 1 },
  ],
};
