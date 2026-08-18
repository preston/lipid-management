// Author: Preston Lee

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel a download in Safari before it consumes the blob URL.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

function cloneSvgForExport(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!clone.getAttribute('xmlns:xlink')) {
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }
  inlineComputedStyles(svg, clone);
  return clone;
}

const EXPORTED_STYLE_PROPERTIES = [
  'color',
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'opacity',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'marker-start',
  'marker-mid',
  'marker-end',
  'shape-rendering',
] as const;

/** Preserve Mermaid and application node-state styling outside the application stylesheet. */
function inlineComputedStyles(source: SVGSVGElement, clone: SVGSVGElement): void {
  const sourceElements = [source, ...Array.from(source.querySelectorAll<SVGElement>('*'))];
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll<SVGElement>('*'))];

  for (let i = 0; i < sourceElements.length; i++) {
    const sourceElement = sourceElements[i];
    const cloneElement = cloneElements[i];
    if (!sourceElement || !cloneElement) {
      continue;
    }
    const computed = getComputedStyle(sourceElement);
    for (const property of EXPORTED_STYLE_PROPERTIES) {
      let value = computed.getPropertyValue(property);
      if (property.startsWith('marker-')) {
        value = value.replace(/url\(["']?.*#([^)"']+)["']?\)/, 'url(#$1)');
      }
      if (value) {
        cloneElement.style.setProperty(property, value);
      }
    }
  }
}

export function serializeDiagramSvg(svg: SVGSVGElement): string {
  const clone = cloneSvgForExport(svg);
  return new XMLSerializer().serializeToString(clone);
}

export function exportDiagramSvg(svg: SVGSVGElement, filename: string): void {
  const xml = serializeDiagramSvg(svg);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, filename);
}
