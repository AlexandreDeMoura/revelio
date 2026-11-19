import { describe, expect, it } from "vitest";
import { newNonce, webviewHtml } from "./webview-html";

const assets = {
  cspSource: "https://webview.example",
  scriptUri: "https://webview.example/dist/webview/webview.js",
  styleUri: "https://webview.example/dist/webview/webview.css",
  nonce: "abc123",
};

// The Content Security Policy of a page, directive by directive.
function csp(html: string): Map<string, string[]> {
  const content = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1];
  if (content === undefined) throw new Error("The page has no Content Security Policy.");
  return new Map(
    content.split(";").map((directive) => {
      const [name = "", ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

describe("webviewHtml", () => {
  it("lets nothing in by default", () => {
    expect(csp(webviewHtml(assets)).get("default-src")).toEqual(["'none'"]);
  });

  it("runs only the script that carries its nonce", () => {
    expect(csp(webviewHtml(assets)).get("script-src")).toEqual(["'nonce-abc123'"]);
  });

  it("takes styles, fonts and images only from the extension", () => {
    const policy = csp(webviewHtml(assets));
    expect(policy.get("style-src")).toEqual([assets.cspSource]);
    expect(policy.get("font-src")).toEqual([assets.cspSource]);
    expect(policy.get("img-src")).toEqual([assets.cspSource, "data:"]);
  });

  it("loads the webview's script with the nonce, and its stylesheet", () => {
    const html = webviewHtml(assets);
    expect(html).toContain(`<script type="module" nonce="abc123" src="${assets.scriptUri}"></script>`);
    expect(html).toContain(`<link rel="stylesheet" href="${assets.styleUri}" />`);
  });

  it("gives the webview a root element to render into", () => {
    expect(webviewHtml(assets)).toContain('<div id="root"></div>');
  });
});

describe("newNonce", () => {
  it("is new every time", () => {
    expect(newNonce()).not.toEqual(newNonce());
  });

  it("holds only characters a Content Security Policy nonce allows", () => {
    expect(newNonce()).toMatch(/^[A-Za-z0-9+/_-]{22,}={0,2}$/);
  });
});
