import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../public/assets/app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/assets/styles.css", import.meta.url), "utf8");

test("documents expose a complete local Markdown editor and safe preview", () => {
  assert.match(app, /key:\s*"content"[\s\S]*?type:\s*"document"/);
  assert.match(app, /function\s+renderDocumentMarkdown\s*\(/);
  assert.match(app, /function\s+safeDocumentHref\s*\([\s\S]*?\^\(https\?:\|mailto:\)/);

  for (const command of [
    "heading2", "heading3", "bold", "italic", "strike", "inline-code",
    "bullet", "numbered", "checklist", "quote", "link", "table",
    "code-block", "divider", "mention",
  ]) {
    assert.match(app, new RegExp(`command\\("${command}"`));
  }

  assert.match(app, /data-document-preview/);
  assert.match(app, /data-document-word-count/);
  assert.match(app, /toggle-document-fullscreen/);
  assert.match(app, /shortcut\s*===\s*"b"[\s\S]*?shortcut\s*===\s*"i"[\s\S]*?shortcut\s*===\s*"k"/);
  assert.match(app, /syncMentionRelations\([\s\S]*?Object\.values\(details\)/);
  assert.match(css, /\.modal\.document-editor-modal/);
  assert.match(css, /\.document-editor-canvas/);
  assert.match(css, /\.document-rendered/);
  assert.match(css, /\.document-table-scroll/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.document-editor\.mode-split \.document-preview-pane/);
});
