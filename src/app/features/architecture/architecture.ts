// Author: Preston Lee

import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { ARCHITECTURE_DIAGRAMS } from './architecture.diagrams';

@Component({
  selector: 'app-architecture',
  templateUrl: './architecture.html',
  styleUrl: './architecture.scss',
})
export class Architecture {
  private readonly host = inject(ElementRef<HTMLElement>);

  private readonly overviewHost = viewChild<ElementRef<HTMLElement>>('overviewDiagram');
  private readonly standaloneHost = viewChild<ElementRef<HTMLElement>>('standaloneDiagram');
  private readonly smartHost = viewChild<ElementRef<HTMLElement>>('smartDiagram');
  private readonly packagingHost = viewChild<ElementRef<HTMLElement>>('packagingDiagram');

  constructor() {
    afterNextRender(() => {
      void this.renderDiagrams();
    });
  }

  private async renderDiagrams(): Promise<void> {
    const hostsById: Record<string, ElementRef<HTMLElement> | undefined> = {
      [ARCHITECTURE_DIAGRAMS[0].hostId]: this.overviewHost(),
      [ARCHITECTURE_DIAGRAMS[1].hostId]: this.standaloneHost(),
      [ARCHITECTURE_DIAGRAMS[2].hostId]: this.smartHost(),
      [ARCHITECTURE_DIAGRAMS[3].hostId]: this.packagingHost(),
    };

    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default',
    });

    for (const diagram of ARCHITECTURE_DIAGRAMS) {
      const hostRef = hostsById[diagram.hostId];
      const el = hostRef?.nativeElement;
      if (!el) {
        continue;
      }
      el.replaceChildren();
      try {
        const { svg } = await mermaid.render(diagram.id, diagram.definition);
        el.innerHTML = svg;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        el.textContent = `Diagram could not be rendered: ${message}`;
        el.classList.add('text-danger');
      }
    }

    // Keep a stable hook for tests that the page finished attempting render.
    this.host.nativeElement.setAttribute('data-architecture-diagrams-rendered', 'true');
  }
}
