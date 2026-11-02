import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedHost, rejectReason, type GuardRequest } from "../core/host.ts";
import { isSafeUrl, renderMarkdown } from "../lib/markdown.ts";

test("loopback hosts are allowed with or without a port; look-alikes are not", () => {
  for (const host of ["127.0.0.1:4310", "localhost:4310", "LOCALHOST", "[::1]:4310", "127.0.0.1"]) assert.ok(isAllowedHost(host), host);
  for (const host of ["rebind.attacker.example:4310", "127.0.0.1.evil.com", "localhost.evil.com", "0.0.0.0:4310", "", null]) {
    assert.ok(!isAllowedHost(host), String(host));
  }
});

test("a --host given to motionmind ui is allowed, and only that one", () => {
  assert.ok(isAllowedHost("studio.lan:4310", ["studio.lan"]));
  assert.ok(isAllowedHost("192.168.1.20:4310", [" 192.168.1.20 "]));
  assert.ok(!isAllowedHost("other.lan:4310", ["studio.lan"]));
});

test("reads pass on an allowed host; mutations need the Studio's own origin", () => {
  const req = (over: Partial<GuardRequest>): GuardRequest => ({ method: "POST", host: "127.0.0.1:4310", origin: "http://127.0.0.1:4310", secFetchSite: "same-origin", ...over });
  assert.equal(rejectReason(req({ method: "GET", origin: null, secFetchSite: null })), null);
  assert.equal(rejectReason(req({})), null);
  assert.equal(rejectReason(req({ secFetchSite: null })), null); // older browsers omit Sec-Fetch-Site
  // DNS rebinding: Host and Origin both carry the attacker's name.
  assert.equal(rejectReason(req({ host: "rebind.attacker.example:4310", origin: "http://rebind.attacker.example:4310" })), "host not allowed");
  assert.equal(rejectReason(req({ method: "GET", host: "rebind.attacker.example:4310" })), "host not allowed");
  assert.equal(rejectReason(req({ origin: "http://evil.example" })), "origin not allowed");
  assert.equal(rejectReason(req({ origin: null })), "origin not allowed");
  assert.equal(rejectReason(req({ secFetchSite: "cross-site" })), "cross-site request");
});

test("markdown shows raw HTML as text", () => {
  const html = renderMarkdown('# T\n<img src="x" onerror="alert(1)">\n\n<script>alert(1)</script>\n\ninline <b onclick="x()">b</b>');
  assert.doesNotMatch(html, /<img|<script|<b /);
  assert.match(html, /&lt;img src=&quot;x&quot; onerror=/);
  assert.match(html, /<h1>T<\/h1>/);
});

test("markdown links keep http(s), mailto and relative URLs and drop script URLs", () => {
  for (const url of ["https://example.com", "http://x", "mailto:a@b.c", "plan/design.html", "#top", "/media/x.png"]) assert.ok(isSafeUrl(url), url);
  for (const url of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\tscript:alert(1)", " javascript:x", "data:text/html,<script>", "vbscript:x"]) {
    assert.ok(!isSafeUrl(url), url);
  }
  const html = renderMarkdown("[a](javascript:alert(1)) [b](https://example.com) ![i](data:image/svg+xml,<svg>)");
  assert.doesNotMatch(html, /javascript:|data:/);
  assert.match(html, /href="https:\/\/example.com"/);
});

test("ordinary markdown is unchanged: tables, code, emphasis", () => {
  const html = renderMarkdown("| a | b |\n|---|---|\n| 1 | **2** |\n\n`<tag>` and `x`");
  assert.match(html, /<table>/);
  assert.match(html, /<strong>2<\/strong>/);
  assert.match(html, /<code>&lt;tag&gt;<\/code>/);
});
