import assert from "node:assert/strict";
import test from "node:test";
import { visitWorkspaceTab, workspaceTabAfterClose, workspaceTabKey, type WorkspaceTab } from "./tab-state";

test("module sections reuse a tab and remember its last location", () => {
  const home = { key: "/", href: "/", title: "Home" };
  const initial = visitWorkspaceTab([home], { key: workspaceTabKey("/registrations", "tab=projects"), href: "/registrations?tab=projects", title: "Registrations" });
  const next = visitWorkspaceTab(initial, { key: workspaceTabKey("/registrations", "tab=partners"), href: "/registrations?tab=partners", title: "Registrations" });
  assert.equal(next.length, 2);
  assert.equal(next[1].href, "/registrations?tab=partners");
  assert.equal(initial[1].href, "/registrations?tab=projects");
});

test("distinct records and contextual forms have isolated tab keys", () => {
  assert.notEqual(workspaceTabKey("/registrations/projects/first", ""), workspaceTabKey("/registrations/projects/second", ""));
  assert.notEqual(workspaceTabKey("/inventory/movements/new", "productId=first"), workspaceTabKey("/inventory/movements/new", "productId=second"));
  assert.equal(workspaceTabKey("/inventory/movements/new", "productId=first&type=ENTRY"), workspaceTabKey("/inventory/movements/new", "type=ENTRY&productId=first"));
});

test("revisiting an editor preserves its record title and position", () => {
  const tabs: WorkspaceTab[] = [{ key: "/", href: "/", title: "Home" }, { key: "/registrations/projects/first", href: "/registrations/projects/first", title: "Edit project: First" }];
  assert.deepEqual(visitWorkspaceTab(tabs, { ...tabs[1], title: "Edit project" }), tabs);
  assert.equal(workspaceTabAfterClose(tabs, tabs[1].key), "/");
});

test("closing the active editor returns to the neighboring screen with its section", () => {
  const tabs: WorkspaceTab[] = [{ key: "/", href: "/", title: "Home" }, { key: "/registrations", href: "/registrations?tab=partners", title: "Registrations" }, { key: "/registrations/partners/new", href: "/registrations/partners/new", title: "New partner" }];
  assert.equal(workspaceTabAfterClose(tabs, tabs[2].key), "/registrations?tab=partners");
  assert.equal(workspaceTabAfterClose([], "missing"), "/");
});
