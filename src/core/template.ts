import { createEffect } from './signal';

type TemplateCache = Map<TemplateStringsArray, HTMLTemplateElement>;

const templateCache: TemplateCache = new Map();
const markerPrefix = '<!--signal:';
const markerSuffix = '-->';

export function html(strings: TemplateStringsArray, ...values: unknown[]): DocumentFragment {
  let template = templateCache.get(strings);
  
  if (!template) {
    template = document.createElement('template');
    let htmlString = '';
    const len = strings.length;
    for (let i = 0; i < len; i++) {
      htmlString += strings[i];
      if (i < values.length) {
        const value = values[i];
        if (typeof value === 'function') {
          htmlString += markerPrefix + i + markerSuffix;
        } else if (value === null || value === undefined) {
          htmlString += '';
        } else if (Array.isArray(value)) {
          for (let j = 0; j < value.length; j++) {
            htmlString += String(value[j] ?? '');
          }
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
    const nodeValue = node.nodeValue;
    if (nodeValue && nodeValue.startsWith('signal:')) {
      const index = parseInt(nodeValue.slice(7), 10);
      signalNodes.push({ node, index });
    }
  }
  
  const signalNodesLen = signalNodes.length;
  for (let i = 0; i < signalNodesLen; i++) {
    const { node, index } = signalNodes[i];
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
    const entries = Object.entries(props);
    const entriesLen = entries.length;
    for (let i = 0; i < entriesLen; i++) {
      const [key, value] = entries[i];
      if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value as EventListener, { passive: true });
      } else if (key === 'className' || key === 'class') {
        if (typeof value === 'function') {
          createEffect(() => {
            element.className = String((value as () => string)());
          });
        } else {
          element.className = String(value);
        }
      } else if (key === 'style') {
        if (typeof value === 'object' && value !== null) {
          const styleEntries = Object.entries(value as Record<string, string>);
          for (let j = 0; j < styleEntries.length; j++) {
            const [styleProp, styleValue] = styleEntries[j];
            element.style.setProperty(styleProp, styleValue);
          }
        } else if (typeof value === 'function') {
          createEffect(() => {
            const styleObj = (value as () => Record<string, string>)();
            if (styleObj && typeof styleObj === 'object') {
              const styleEntries = Object.entries(styleObj);
              for (let j = 0; j < styleEntries.length; j++) {
                const [styleProp, styleValue] = styleEntries[j];
                element.style.setProperty(styleProp, styleValue);
              }
            }
          });
        }
      } else if (key === 'ref' && typeof value === 'function') {
        (value as (el: HTMLElement) => void)(element);
      } else if (key === 'innerHTML') {
        if (typeof value === 'function') {
          createEffect(() => {
            element.innerHTML = String((value as () => string)());
          });
        } else {
          element.innerHTML = String(value);
        }
      } else if (typeof value === 'function') {
        createEffect(() => {
          const result = (value as () => unknown)();
          if (typeof result === 'boolean') {
            if (result) {
              element.setAttribute(key, '');
            } else {
              element.removeAttribute(key);
            }
          } else if (result === null || result === undefined) {
            element.removeAttribute(key);
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
  
  const childrenLen = children.length;
  for (let i = 0; i < childrenLen; i++) {
    const child = children[i];
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
    if (node.parentNode === container) {
      container.removeChild(node);
    }
  };
}

export function render(component: () => Node, container: HTMLElement): void {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  const node = component();
  container.appendChild(node);
}

export function fragment(...children: (Node | string)[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  const len = children.length;
  for (let i = 0; i < len; i++) {
    const child = children[i];
    if (typeof child === 'string') {
      frag.appendChild(document.createTextNode(child));
    } else {
      frag.appendChild(child);
    }
  }
  return frag;
}

export function when<T>(
  condition: () => T,
  trueBranch: (value: T) => Node,
  falseBranch?: () => Node
): () => Node {
  return () => {
    const value = condition();
    if (value) {
      return trueBranch(value);
    }
    return falseBranch ? falseBranch() : document.createTextNode('');
  };
}

export function each<T>(
  items: () => T[],
  keyFn: (item: T, index: number) => string | number,
  renderItem: (item: T, index: number) => Node
): () => DocumentFragment {
  return () => {
    const frag = document.createDocumentFragment();
    const currentItems = items();
    const len = currentItems.length;
    for (let i = 0; i < len; i++) {
      frag.appendChild(renderItem(currentItems[i], i));
    }
    return frag;
  };
}

export function createPortal(content: () => Node, target: HTMLElement): () => void {
  const node = content();
  target.appendChild(node);
  
  return () => {
    if (node.parentNode === target) {
      target.removeChild(node);
    }
  };
}
