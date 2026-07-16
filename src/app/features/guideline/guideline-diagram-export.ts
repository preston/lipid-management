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

/**
 * Rasterize the live Mermaid SVG to PNG at 2× scale.
 * Rejects if canvas export fails (e.g. tainted canvas); callers should keep SVG as primary.
 */
export function exportDiagramPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const xml = serializeDiagramSvg(svg);
  const bbox = svg.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(svg.viewBox?.baseVal?.width || bbox.width || 800));
  const height = Math.max(1, Math.ceil(svg.viewBox?.baseVal?.height || bbox.height || 600));
  const scale = 2;

  return new Promise((resolve, reject) => {
    const image = new Image();
    const svgUrl = URL.createObjectURL(
      new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }),
    );

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(svgUrl);
          reject(new Error('Canvas is unavailable for PNG export'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.drawImage(image, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(svgUrl);
          if (!blob) {
            reject(new Error('PNG export failed'));
            return;
          }
          triggerDownload(blob, filename);
          resolve();
        }, 'image/png');
      } catch (err) {
        URL.revokeObjectURL(svgUrl);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error('Could not load SVG for PNG export'));
    };

    image.src = svgUrl;
  });
}
