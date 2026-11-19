import { randomBytes } from "node:crypto";

export type WebviewAssets = {
  // Where the webview may load the extension's own files from (`webview.cspSource`).
  cspSource: string;
  // The webview's script and stylesheet, as webview URIs.
  scriptUri: string;
  styleUri: string;
  // A value used once, which marks the one script allowed to run.
  nonce: string;
};

// The page the Revelio view loads. Its Content Security Policy lets in nothing but the
// extension's own stylesheet, fonts and images, and runs only the script carrying the nonce.
export function webviewHtml({ cspSource, scriptUri, styleUri, nonce }: WebviewAssets): string {
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src ${cspSource}`,
    `font-src ${cspSource}`,
    `img-src ${cspSource} data:`,
  ].join("; ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Revelio</title>
<link rel="stylesheet" href="${styleUri}" />
</head>
<body>
<div id="root"></div>
<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>
`;
}

export function newNonce(): string {
  return randomBytes(16).toString("base64");
}
