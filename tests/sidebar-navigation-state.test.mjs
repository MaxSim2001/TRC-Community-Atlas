import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../public/assets/app.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../public/assets/styles.css", import.meta.url), "utf8");

test("sidebar keeps its scroll position and module filter across navigation renders", () => {
  assert.match(app, /sidebarScrollTop:\s*0/);
  assert.match(app, /preserveSidebarScroll:\s*false/);
  assert.match(app, /currentSidebarNavigation\.scrollTop/);
  assert.match(app, /function\s+restoreSidebarNavigation\s*\(/);
  assert.match(app, /navigation\.scrollTop\s*=\s*scrollTop/);
  assert.match(app, /requestAnimationFrame\(\(\)\s*=>\s*\{\s*if\s*\(navigation\.isConnected\)\s*navigation\.scrollTop\s*=\s*scrollTop/);
  assert.match(app, /state\.preserveSidebarScroll\s*=\s*location\.hash\s*!==\s*nextHash/);
  assert.match(app, /if\s*\(sidebarNavigation\)\s*state\.sidebarScrollTop\s*=\s*sidebarNavigation\.scrollTop/);
  assert.match(app, /value="\$\{escapeHtml\(state\.sidebarModuleSearch\)\}"/);
  assert.match(app, /state\.sidebarModuleSearch\s*=\s*event\.target\.value/);
  assert.match(app, /requestAnimationFrame\(\(\)\s*=>\s*window\.scrollTo\(\{\s*top:\s*0,\s*left:\s*0,\s*behavior:\s*"auto"\s*\}\)\)/);
  assert.match(styles, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test("Atlas tools are grouped and collapsed by default", () => {
  assert.match(app, /collapsedNavGroups:\s*new Set\(\["custom",\s*"tools"\]\)/);
  assert.match(app, /function\s+renderAtlasToolsNavigation\s*\(/);
  assert.match(app, /data-action="toggle-nav-group"\s+data-group="tools"/);
  assert.match(app, /class="nav-group-items nav-tool-items"/);
  assert.match(app, /state\.collapsedNavGroups\.has\("tools"\)/);
  assert.match(styles, /\.nav-module-group\.collapsed\s+\.nav-group-items\s*\{\s*display:\s*none;/);
});
