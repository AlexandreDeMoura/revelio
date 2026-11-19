// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./app";

afterEach(cleanup);

describe("App", () => {
  it("says Hello world", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Hello world" })).toBeTruthy();
  });
});
