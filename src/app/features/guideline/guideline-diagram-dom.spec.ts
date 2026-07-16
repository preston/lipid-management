// Author: Preston Lee

import { describe, expect, it, vi } from 'vitest';
import { attachDiagramInteractivity } from './guideline-diagram-dom';
import { serializeDiagramSvg } from './guideline-diagram-export';

describe('guideline-diagram-dom', () => {
  it('assigns stable box ids and invokes onSelect', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'node');
    g.id = 'flowchart-B8-0';
    svg.appendChild(g);

    const onSelect = vi.fn();
    const controller = attachDiagramInteractivity(svg, {
      onSelect,
      tooltipForBox: (id) => `tip ${id}`,
    });

    expect(g.id).toBe('guideline-diagram-box-8');
    expect(g.querySelector('title')?.textContent).toBe('tip 8');
    expect(g.getAttribute('aria-label')).toBe('tip 8');
    g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(8);

    controller.select(8);
    expect(g.classList.contains('diagram-box-selected')).toBe(true);
    controller.destroy();
  });
});

describe('guideline-diagram-export', () => {
  it('serializes an SVG element to XML', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '10');
    svg.setAttribute('height', '10');
    const xml = serializeDiagramSvg(svg);
    expect(xml).toContain('<svg');
    expect(xml).toContain('xmlns');
  });

  it('inlines application-computed node styles for standalone export', () => {
    const style = document.createElement('style');
    style.textContent = '.export-active rect { fill: rgb(1, 2, 3); stroke-width: 3px; }';
    document.head.appendChild(style);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    group.setAttribute('class', 'export-active');
    group.appendChild(rect);
    svg.appendChild(group);
    document.body.appendChild(svg);

    const xml = serializeDiagramSvg(svg);
    expect(xml).toContain('fill: rgb(1, 2, 3)');
    expect(xml).toContain('stroke-width: 3px');

    svg.remove();
    style.remove();
  });
});
