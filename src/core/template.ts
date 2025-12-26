import { createEffect } from './signal';

type TemplateCache = Map<TemplateStringsArray, HTMLTemplateElement>;

const templateCache: TemplateCache = new Map();

export function html(strings: TemplateStringsArray, ...values: unknown[]): DocumentFragment {
  let template = templateCache.get(strings);
  
  if (!template) {
    template = document.createElement('template');
    let htmlString = '';
    for (let i = 0; i < strings.length; i++) {
      htmlString += strings[i];
      if (i < values.length) {
        const value = values[i];
        if (typeof value === 'function') {
          htmlString += `<!--signal:${i}-->`;
        } else if (value === null || value === undefined) {
          htmlString += '';
        } else {
          htmlString += String(value);
        }
      }
    }
    template.innerHTML = htmlString;
    templateCache.set(strings, template);
  }
  
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_COMMENT);
  const signalNodes: { node: Comment; index: number }[] = [];
  
  let node: Comment | null;
  while ((node = walker.nextNode() as Comment | null)) {
    const match = node.nodeValue?.match(/^signal:(\d+)$/);
    if (match) {
      signalNodes.push({ node, index: parseInt(match[1], 10) });
    }
  }
  
  for (const { node, index } of signalNodes) {
    const value = values[index];
    if (typeof value === 'function') {
      const textNode = document.createTextNode('');
      node.parentNode?.replaceChild(textNode, node);
      
      const signalFn = value as () => unknown;
      
      createEffect(() => {
        const result = signalFn();
        textNode.textContent = result === null || result === undefined ? '' : String(result);
      });
    }
  }
  
  return fragment;
}

export function createElement(
  tag: string,
  props: Record<string, unknown> | null,
  ...children: (Node | string | (() => unknown))[]
): HTMLElement {
  const element = document.createElement(tag);
  
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value as EventListener);
      } else if (key === 'className' || key === 'class') {
        if (typeof value === 'function') {
          createEffect(() => {
            element.className = String((value as () => string)());
          });
        } else {
          element.className = String(value);
        }
      } else if (key === 'style' && typeof value === 'object' && value !== null) {
        for (const [styleProp, styleValue] of Object.entries(value as Record<string, string>)) {
          element.style.setProperty(styleProp, styleValue);
        }
      } else if (key === 'ref' && typeof value === 'function') {
        (value as (el: HTMLElement) => void)(element);
      } else if (typeof value === 'function') {
        createEffect(() => {
          const result = (value as () => unknown)();
          if (typeof result === 'boolean') {
            if (result) {
              element.setAttribute(key, '');
            } else {
              element.removeAttribute(key);
            }
          } else {
            element.setAttribute(key, String(result));
          }
        });
      } else if (typeof value === 'boolean') {
        if (value) {
          element.setAttribute(key, '');
        }
      } else if (value !== null && value !== undefined) {
        element.setAttribute(key, String(value));
      }
    }
  }
  
  for (const child of children) {
    if (child instanceof Node) {
      element.appendChild(child);
    } else if (typeof child === 'function') {
      const textNode = document.createTextNode('');
      element.appendChild(textNode);
      
      createEffect(() => {
        const result = (child as () => unknown)();
        textNode.textContent = result === null || result === undefined ? '' : String(result);
      });
    } else if (child !== null && child !== undefined) {
      element.appendChild(document.createTextNode(String(child)));
    }
  }
  
  return element;
}

export function mount(container: HTMLElement, component: () => Node): () => void {
  const node = component();
  container.appendChild(node);
  
  return () => {
    container.removeChild(node);
  };
}

export function render(component: () => Node, container: HTMLElement): void {
  container.innerHTML = '';
  const node = component();
  container.appendChild(node);
}