import { describe, expect, test } from "bun:test";
import { createSettingsPopoverMount } from "../src/ui/settings-popover";

type FixtureElement = {
  parentElement?: FixtureElement;
  matches(selector: string): boolean;
  querySelector(selector: string): FixtureElement | null;
  appendChild(child: FixtureElement): void;
  remove(): void;
  className?: string;
};

function element(
  selectors: string[] = [],
  descendants: Record<string, FixtureElement> = {},
): FixtureElement {
  return {
    matches(selector) {
      return selectors.includes(selector);
    },
    querySelector(selector) {
      return descendants[selector] ?? null;
    },
    appendChild(child) {
      child.parentElement = this;
    },
    remove() {
      if (this.parentElement) this.parentElement = undefined;
    },
  };
}

describe("settings popover portal mount", () => {
  test("uses the host settings popover layer inside the active modal", () => {
    const body = element(["body"]);
    const popoverLayer = element([".settings-popover-layer"]);
    const dialog = element(['[data-component="dialog"]'], {
      ".settings-popover-layer": popoverLayer,
    });
    const content = element(['[data-slot="dialog-content"]']);
    const input = element();
    body.appendChild(dialog);
    dialog.appendChild(content);
    dialog.appendChild(popoverLayer);
    content.appendChild(input);

    const mountElement = element();
    const mount = createSettingsPopoverMount(
      input as unknown as HTMLElement,
      body as unknown as HTMLElement,
      () => mountElement as unknown as HTMLElement,
    );

    expect(mount.parentElement).toBe(popoverLayer as unknown as HTMLElement);
    expect(mount.className).toBe("vl-language-portal");
    mount.remove();
    expect(mount.parentElement).toBeUndefined();
  });

  test("falls back to the document body outside a settings dialog", () => {
    const body = element(["body"]);
    const input = element();
    body.appendChild(input);
    const mountElement = element();

    const mount = createSettingsPopoverMount(
      input as unknown as HTMLElement,
      body as unknown as HTMLElement,
      () => mountElement as unknown as HTMLElement,
    );

    expect(mount.parentElement).toBe(body as unknown as HTMLElement);
  });
});
