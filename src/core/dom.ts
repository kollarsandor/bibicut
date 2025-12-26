import { createEffect } from './signal';

export interface DOMBinding<T> {
  element: HTMLElement;
  update: (value: T) => void;
  destroy: () => void;
}

export function bindText<T>(
  element: HTMLElement,
  signal: () => T,
  formatter?: (value: T) => string
): DOMBinding<T> {
  const textNode = document.createTextNode('');
  element.appendChild(textNode);
  
  const cleanup = createEffect(() => {
    const value = signal();
    textNode.textContent = formatter ? formatter(value) : String(value ?? '');
  });
  
  return {
    element,
    update: (value: T) => {
      textNode.textContent = formatter ? formatter(value) : String(value ?? '');
    },
    destroy: cleanup
  };
}

export function bindAttribute(
  element: HTMLElement,
  attribute: string,
  signal: () => string | number | boolean | null | undefined
): () => void {
  return createEffect(() => {
    const value = signal();
    if (value === null || value === undefined || value === false) {
      element.removeAttribute(attribute);
    } else if (value === true) {
      element.setAttribute(attribute, '');
    } else {
      element.setAttribute(attribute, String(value));
    }
  });
}

export function bindClass(
  element: HTMLElement,
  className: string,
  signal: () => boolean
): () => void {
  return createEffect(() => {
    const shouldHave = signal();
    if (shouldHave) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  });
}

export function bindClasses(
  element: HTMLElement,
  classMap: () => Record<string, boolean>
): () => void {
  return createEffect(() => {
    const map = classMap();
    const entries = Object.entries(map);
    const len = entries.length;
    for (let i = 0; i < len; i++) {
      const [cls, active] = entries[i];
      if (active) {
        element.classList.add(cls);
      } else {
        element.classList.remove(cls);
      }
    }
  });
}

export function bindStyle(
  element: HTMLElement,
  property: string,
  signal: () => string | number | null
): () => void {
  return createEffect(() => {
    const value = signal();
    if (value === null) {
      element.style.removeProperty(property);
    } else {
      element.style.setProperty(property, String(value));
    }
  });
}

export function bindStyles(
  element: HTMLElement,
  styles: () => Record<string, string | number | null>
): () => void {
  return createEffect(() => {
    const styleMap = styles();
    const entries = Object.entries(styleMap);
    const len = entries.length;
    for (let i = 0; i < len; i++) {
      const [prop, value] = entries[i];
      if (value === null) {
        element.style.removeProperty(prop);
      } else {
        element.style.setProperty(prop, String(value));
      }
    }
  });
}

export function bindVisibility(
  element: HTMLElement,
  signal: () => boolean
): () => void {
  const originalDisplay = element.style.display || '';
  
  return createEffect(() => {
    const visible = signal();
    element.style.display = visible ? originalDisplay : 'none';
  });
}

export function bindDisabled(
  element: HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  signal: () => boolean
): () => void {
  return createEffect(() => {
    element.disabled = signal();
  });
}

export function bindValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  signal: () => string,
  onChange?: (value: string) => void
): () => void {
  const cleanup = createEffect(() => {
    element.value = signal();
  });
  
  if (onChange) {
    const handler = (e: Event): void => {
      onChange((e.target as HTMLInputElement).value);
    };
    element.addEventListener('input', handler);
    return () => {
      cleanup();
      element.removeEventListener('input', handler);
    };
  }
  
  return cleanup;
}

export function bindChecked(
  element: HTMLInputElement,
  signal: () => boolean,
  onChange?: (checked: boolean) => void
): () => void {
  const cleanup = createEffect(() => {
    element.checked = signal();
  });
  
  if (onChange) {
    const handler = (e: Event): void => {
      onChange((e.target as HTMLInputElement).checked);
    };
    element.addEventListener('change', handler);
    return () => {
      cleanup();
      element.removeEventListener('change', handler);
    };
  }
  
  return cleanup;
}

export interface ListBinding<T> {
  container: HTMLElement;
  update: (items: T[]) => void;
  destroy: () => void;
}

export function bindList<T>(
  container: HTMLElement,
  itemsSignal: () => T[],
  keyFn: (item: T, index: number) => string | number,
  renderItem: (item: T, index: number) => HTMLElement
): ListBinding<T> {
  const itemMap = new Map<string | number, { element: HTMLElement; item: T }>();
  
  const cleanup = createEffect(() => {
    const items = itemsSignal();
    const newKeys = new Set<string | number>();
    const len = items.length;
    
    for (let i = 0; i < len; i++) {
      const item = items[i];
      const key = keyFn(item, i);
      newKeys.add(key);
      
      const existing = itemMap.get(key);
      if (existing) {
        if (existing.item !== item) {
          const newElement = renderItem(item, i);
          container.replaceChild(newElement, existing.element);
          itemMap.set(key, { element: newElement, item });
        }
      } else {
        const element = renderItem(item, i);
        itemMap.set(key, { element, item });
        
        if (i < container.children.length) {
          container.insertBefore(element, container.children[i]);
        } else {
          container.appendChild(element);
        }
      }
    }
    
    itemMap.forEach((value, key) => {
      if (!newKeys.has(key)) {
        container.removeChild(value.element);
        itemMap.delete(key);
      }
    });
    
    for (let i = 0; i < len; i++) {
      const key = keyFn(items[i], i);
      const entry = itemMap.get(key);
      if (entry && container.children[i] !== entry.element) {
        container.insertBefore(entry.element, container.children[i]);
      }
    }
  });
  
  return {
    container,
    update: () => {},
    destroy: () => {
      cleanup();
      itemMap.clear();
    }
  };
}

export function createDOMElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number | boolean | null | undefined>,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  
  if (attrs) {
    const entries = Object.entries(attrs);
    const len = entries.length;
    for (let i = 0; i < len; i++) {
      const [key, value] = entries[i];
      if (value === null || value === undefined || value === false) {
        continue;
      }
      if (value === true) {
        element.setAttribute(key, '');
      } else {
        element.setAttribute(key, String(value));
      }
    }
  }
  
  const childLen = children.length;
  for (let i = 0; i < childLen; i++) {
    const child = children[i];
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  }
  
  return element;
}

export function patchElement(
  element: HTMLElement,
  updates: Partial<{
    className: string;
    style: Record<string, string | null>;
    attributes: Record<string, string | null>;
    textContent: string;
  }>
): void {
  if (updates.className !== undefined) {
    element.className = updates.className;
  }
  
  if (updates.style) {
    const entries = Object.entries(updates.style);
    const len = entries.length;
    for (let i = 0; i < len; i++) {
      const [prop, value] = entries[i];
      if (value === null) {
        element.style.removeProperty(prop);
      } else {
        element.style.setProperty(prop, value);
      }
    }
  }
  
  if (updates.attributes) {
    const entries = Object.entries(updates.attributes);
    const len = entries.length;
    for (let i = 0; i < len; i++) {
      const [attr, value] = entries[i];
      if (value === null) {
        element.removeAttribute(attr);
      } else {
        element.setAttribute(attr, value);
      }
    }
  }
  
  if (updates.textContent !== undefined) {
    element.textContent = updates.textContent;
  }
}

export function createCustomEvent<T>(name: string, detail: T): CustomEvent<T> {
  return new CustomEvent(name, {
    detail,
    bubbles: true,
    cancelable: true,
    composed: true
  });
}

export function dispatchCustomEvent<T>(element: HTMLElement, name: string, detail: T): boolean {
  return element.dispatchEvent(createCustomEvent(name, detail));
}

export function onCustomEvent<T>(
  element: HTMLElement,
  name: string,
  handler: (detail: T) => void,
  options?: AddEventListenerOptions
): () => void {
  const listener = (event: Event): void => {
    handler((event as CustomEvent<T>).detail);
  };
  
  element.addEventListener(name, listener, options);
  
  return () => {
    element.removeEventListener(name, listener, options);
  };
}

export function on<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions
): () => void {
  element.addEventListener(event, handler as EventListener, options);
  return () => element.removeEventListener(event, handler as EventListener, options);
}

export function delegate<K extends keyof HTMLElementEventMap>(
  container: HTMLElement,
  event: K,
  selector: string,
  handler: (e: HTMLElementEventMap[K], target: HTMLElement) => void,
  options?: AddEventListenerOptions
): () => void {
  const listener = (e: Event): void => {
    const target = (e.target as HTMLElement).closest(selector);
    if (target && container.contains(target)) {
      handler(e as HTMLElementEventMap[K], target as HTMLElement);
    }
  };
  
  container.addEventListener(event, listener, options);
  return () => container.removeEventListener(event, listener, options);
}

export function observeIntersection(
  element: HTMLElement,
  callback: (isIntersecting: boolean, entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
): () => void {
  const observer = new IntersectionObserver((entries) => {
    const len = entries.length;
    for (let i = 0; i < len; i++) {
      callback(entries[i].isIntersecting, entries[i]);
    }
  }, options);
  
  observer.observe(element);
  
  return () => {
    observer.disconnect();
  };
}

export function observeResize(
  element: HTMLElement,
  callback: (entry: ResizeObserverEntry) => void
): () => void {
  const observer = new ResizeObserver((entries) => {
    const len = entries.length;
    for (let i = 0; i < len; i++) {
      callback(entries[i]);
    }
  });
  
  observer.observe(element);
  
  return () => {
    observer.disconnect();
  };
}

export function observeMutation(
  element: HTMLElement,
  callback: (mutations: MutationRecord[]) => void,
  options?: MutationObserverInit
): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(element, options || { childList: true, subtree: true });
  return () => observer.disconnect();
}

export function setAttributes(
  element: HTMLElement,
  attrs: Record<string, string | number | boolean | null | undefined>
): void {
  const entries = Object.entries(attrs);
  const len = entries.length;
  for (let i = 0; i < len; i++) {
    const [key, value] = entries[i];
    if (value === null || value === undefined || value === false) {
      element.removeAttribute(key);
    } else if (value === true) {
      element.setAttribute(key, '');
    } else {
      element.setAttribute(key, String(value));
    }
  }
}

export function setStyles(
  element: HTMLElement,
  styles: Record<string, string | number | null>
): void {
  const entries = Object.entries(styles);
  const len = entries.length;
  for (let i = 0; i < len; i++) {
    const [prop, value] = entries[i];
    if (value === null) {
      element.style.removeProperty(prop);
    } else {
      element.style.setProperty(prop, String(value));
    }
  }
}

export function addClass(element: HTMLElement, ...classNames: string[]): void {
  element.classList.add(...classNames);
}

export function removeClass(element: HTMLElement, ...classNames: string[]): void {
  element.classList.remove(...classNames);
}

export function toggleClass(element: HTMLElement, className: string, force?: boolean): boolean {
  return element.classList.toggle(className, force);
}

export function hasClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className);
}

export function replaceChildren(element: HTMLElement, ...nodes: (Node | string)[]): void {
  element.replaceChildren(...nodes);
}

export function insertAdjacent(
  element: HTMLElement,
  position: InsertPosition,
  node: Node | string
): void {
  if (typeof node === 'string') {
    element.insertAdjacentHTML(position, node);
  } else {
    element.insertAdjacentElement(position, node as Element);
  }
}
