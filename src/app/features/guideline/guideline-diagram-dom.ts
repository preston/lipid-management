// Author: Preston Lee

const BOX_NODE_ID_RE = /^flowchart-B(\d+)(?:-\d+)?$/;
const FOCUS_CLASS = 'diagram-box-focus';
const SELECTED_CLASS = 'diagram-box-selected';

export interface DiagramInteractivityOptions {
  onSelect: (boxId: number) => void;
  tooltipForBox: (boxId: number) => string;
}

export interface DiagramInteractivityController {
  focus(boxId: number): void;
  select(boxId: number): void;
  clearFocus(): void;
  clearSelection(): void;
  destroy(): void;
}

function parseBoxIdFromMermaidNode(el: Element): number | null {
  const rawId = el.id || '';
  const match = BOX_NODE_ID_RE.exec(rawId);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

/**
 * Attach click/keyboard selection and stable DOM ids to a rendered Mermaid SVG.
 * Clinical text must be supplied via options — this layer has no evaluation knowledge.
 */
export function attachDiagramInteractivity(
  svgRoot: SVGSVGElement,
  options: DiagramInteractivityOptions,
): DiagramInteractivityController {
  const nodesByBox = new Map<number, SVGGElement>();
  const cleanups: Array<() => void> = [];
  let focusedBox: number | null = null;
  let selectedBox: number | null = null;
  let focusAnimationTarget: SVGGElement | null = null;
  let focusAnimationHandler: ((event: AnimationEvent) => void) | null = null;

  const nodeGroups = svgRoot.querySelectorAll<SVGGElement>('g.node');
  for (const group of Array.from(nodeGroups)) {
    const boxId = parseBoxIdFromMermaidNode(group);
    if (boxId == null) {
      continue;
    }
    nodesByBox.set(boxId, group);
    group.id = `guideline-diagram-box-${boxId}`;
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    const tooltip = options.tooltipForBox(boxId);
    group.setAttribute('aria-label', tooltip);
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = tooltip;
    group.prepend(title);
    group.classList.add('diagram-box-interactive');

    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      options.onSelect(boxId);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        options.onSelect(boxId);
      }
    };
    group.addEventListener('click', onClick);
    group.addEventListener('keydown', onKey);
    cleanups.push(() => {
      group.removeEventListener('click', onClick);
      group.removeEventListener('keydown', onKey);
    });
  }

  const detachFocusAnimation = (): void => {
    if (focusAnimationTarget && focusAnimationHandler) {
      focusAnimationTarget.removeEventListener('animationend', focusAnimationHandler);
    }
    focusAnimationTarget = null;
    focusAnimationHandler = null;
  };

  const clearFocusClass = (): void => {
    detachFocusAnimation();
    if (focusedBox == null) {
      return;
    }
    const el = nodesByBox.get(focusedBox);
    el?.classList.remove(FOCUS_CLASS);
    focusedBox = null;
  };

  const onAnimationEnd = (event: AnimationEvent): void => {
    if (event.animationName !== 'guideline-diagram-box-focus-pulse') {
      return;
    }
    const target = event.currentTarget as SVGGElement | null;
    target?.classList.remove(FOCUS_CLASS);
    if (target && focusedBox != null) {
      const current = nodesByBox.get(focusedBox);
      if (current === target) {
        focusedBox = null;
      }
    }
    detachFocusAnimation();
  };

  const controller: DiagramInteractivityController = {
    focus(boxId: number): void {
      clearFocusClass();
      const el = nodesByBox.get(boxId);
      if (!el) {
        return;
      }
      focusedBox = boxId;
      el.classList.add(FOCUS_CLASS);
      focusAnimationTarget = el;
      focusAnimationHandler = onAnimationEnd;
      el.addEventListener('animationend', onAnimationEnd);
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    },
    select(boxId: number): void {
      if (selectedBox != null) {
        nodesByBox.get(selectedBox)?.classList.remove(SELECTED_CLASS);
      }
      selectedBox = boxId;
      nodesByBox.get(boxId)?.classList.add(SELECTED_CLASS);
    },
    clearFocus: clearFocusClass,
    clearSelection(): void {
      if (selectedBox == null) {
        return;
      }
      nodesByBox.get(selectedBox)?.classList.remove(SELECTED_CLASS);
      selectedBox = null;
    },
    destroy(): void {
      for (const cleanup of cleanups) {
        cleanup();
      }
      cleanups.length = 0;
      clearFocusClass();
      controller.clearSelection();
      nodesByBox.clear();
    },
  };

  return controller;
}

export function findDiagramSvg(host: HTMLElement): SVGSVGElement | null {
  return host.querySelector('svg');
}
