export function settingsPopoverParent(
  anchor: HTMLElement,
  body: HTMLElement,
): HTMLElement {
  let current: HTMLElement | null = anchor;
  while (current) {
    if (current.matches('[data-component="dialog"]')) {
      return (
        current.querySelector<HTMLElement>(".settings-popover-layer") ?? current
      );
    }
    current = current.parentElement;
  }
  return body;
}

export function createSettingsPopoverMount(
  anchor: HTMLElement,
  body: HTMLElement,
  createElement: () => HTMLElement = () => document.createElement("div"),
): HTMLElement {
  const mount = createElement();
  mount.className = "vl-language-portal";
  settingsPopoverParent(anchor, body).appendChild(mount);
  return mount;
}
