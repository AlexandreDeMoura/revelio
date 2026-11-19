// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./app";
import { sampleFlow } from "./sample-flow";

afterEach(cleanup);

describe("App", () => {
  it("shows the Flow page of the sample Flow", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: sampleFlow.name })).toBeTruthy();
  });
});
