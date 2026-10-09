import assert from "node:assert/strict";
import test from "node:test";
import { retainWorkspaceScreen, workspaceScreenLocation, workspaceScreenMaxAge, workspaceScreenNeedsRefresh, type CachedScreen } from "./screen-cache";

function createScreen(pathname: string, visitedAt: number, overrides: Partial<CachedScreen<string>> = {}): CachedScreen<string> {
  return { ...workspaceScreenLocation(pathname), content: pathname, visitedAt, loadedAt: 1_000, stale: false, ...overrides };
}

test("the default limit retains eight screens and evicts the least recently visited screen", () => {
  const screens = Array.from({ length: 8 }, (_, index) => createScreen(`/screen-${index}`, index + 1));
  screens[0] = { ...screens[0], visitedAt: 20 };
  const incoming = createScreen("/next", 21);

  const retained = retainWorkspaceScreen(screens, incoming, incoming.key);

  assert.equal(retained.length, 8);
  assert.ok(retained.some((screen) => screen.key === "/screen-0"));
  assert.ok(!retained.some((screen) => screen.key === "/screen-1"));
  assert.ok(retained.includes(incoming));
  assert.equal(screens.length, 8);
  assert.ok(screens.some((screen) => screen.key === "/screen-1"));
});

test("replacing a cached screen updates its content without evicting or changing the other screens", () => {
  const first = createScreen("/inventory", 1);
  const second = createScreen("/reports", 2);
  const replacement = createScreen("/inventory", 3, { content: "Updated inventory", href: "/inventory?tab=movements", loadedAt: 2_000 });

  const retained = retainWorkspaceScreen([first, second], replacement, first.key);

  assert.equal(retained.length, 2);
  assert.equal(retained.find((screen) => screen.key === second.key), second);
  assert.equal(retained.find((screen) => screen.key === first.key), replacement);
  assert.equal(first.content, "/inventory");
});

test("the active screen remains loaded even when it has the oldest visit", () => {
  const active = createScreen("/active", 0);
  const screens = [active, ...Array.from({ length: 7 }, (_, index) => createScreen(`/screen-${index}`, index + 1))];

  const retained = retainWorkspaceScreen(screens, createScreen("/background", 9), active.key);

  assert.equal(retained.length, 8);
  assert.equal(retained.find((screen) => screen.key === active.key), active);
  assert.ok(!retained.some((screen) => screen.key === "/screen-0"));
});

test("a configured limit of one retains only the active screen", () => {
  const active = createScreen("/active", 1);
  const incoming = createScreen("/background", 2);

  assert.deepEqual(retainWorkspaceScreen([active], incoming, active.key, 1), [active]);
  assert.deepEqual(retainWorkspaceScreen([active], incoming, incoming.key, 1), [incoming]);
});

test("reducing the configured limit to four evicts older screens while protecting the active one", () => {
  const screens = Array.from({ length: 8 }, (_, index) => createScreen(`/screen-${index}`, index + 1));
  const retained = retainWorkspaceScreen(screens, createScreen("/screen-7", 9), "/screen-0", 4);

  assert.equal(retained.length, 4);
  assert.deepEqual(retained.map((screen) => screen.key).sort(), ["/screen-0", "/screen-5", "/screen-6", "/screen-7"]);
});

test("configured limits are bounded by one and eight loaded screens", () => {
  const screens = Array.from({ length: 8 }, (_, index) => createScreen(`/screen-${index}`, index + 1));
  const incoming = createScreen("/next", 9);

  assert.equal(retainWorkspaceScreen(screens, incoming, incoming.key, 100).length, 8);
  assert.deepEqual(retainWorkspaceScreen(screens, incoming, incoming.key, 0), [incoming]);
});

test("equivalent query orders share a cache key and canonical href", () => {
  const first = workspaceScreenLocation("/inventory/movements/new", "type=ENTRY&productId=first");
  const second = workspaceScreenLocation("/inventory/movements/new", "?productId=first&type=ENTRY");

  assert.deepEqual(first, second);
  assert.equal(first.key, "/inventory/movements/new?productId=first&type=ENTRY");
  assert.notEqual(first.key, workspaceScreenLocation("/inventory/movements/new", "productId=second&type=ENTRY").key);
});

test("module sections share one screen key while preserving their distinct hrefs", () => {
  const products = workspaceScreenLocation("/inventory", "tab=products");
  const movements = workspaceScreenLocation("/inventory", "tab=movements");

  assert.equal(products.key, movements.key);
  assert.notEqual(products.href, movements.href);
  assert.deepEqual(workspaceScreenLocation("/reports"), { key: "/reports", href: "/reports", pathname: "/reports" });
});

test("fresh screens expire at the TTL boundary and invalidated screens refresh immediately", () => {
  const screen = createScreen("/inventory", 1);

  assert.equal(workspaceScreenNeedsRefresh(screen, screen.loadedAt), false);
  assert.equal(workspaceScreenNeedsRefresh(screen, screen.loadedAt + workspaceScreenMaxAge - 1), false);
  assert.equal(workspaceScreenNeedsRefresh(screen, screen.loadedAt + workspaceScreenMaxAge), true);
  assert.equal(workspaceScreenNeedsRefresh({ ...screen, stale: true }, screen.loadedAt), true);
});
