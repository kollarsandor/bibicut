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

export function bindVisibility(
  element: HTMLElement,
  signal: () => boolean
): () => void {
  const originalDisplay = element.style.display;
  
  return createEffect(() => {
    const visible = signal();
    element.style.display = visible ? originalDisplay : 'none';
  });
}

export function bindDisabled(
  element: HTMLButtonElement | HTMLInputElement,
  signal: () => boolean
): () => void {
  return createEffect(() => {
    element.disabled = signal();
  });
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
    
    for (let i = 0; i < items.length; i++) {
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
    
    const children = Array.from(container.children);
    for (let i = 0; i < items.length; i++) {
      const key = keyFn(items[i], i);
      const entry = itemMap.get(key);
      if (entry && children[i] !== entry.element) {
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
    for (const [key, value] of Object.entries(attrs)) {
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
  
  for (const child of children) {
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
    for (const [prop, value] of Object.entries(updates.style)) {
      if (value === null) {
        element.style.removeProperty(prop);
      } else {
        element.style.setProperty(prop, value);
      }
    }
  }
  
  if (updates.attributes) {
    for (const [attr, value] of Object.entries(updates.attributes)) {
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
  handler: (detail: T) => void
): () => void {
  const listener = (event: Event): void => {
    handler((event as CustomEvent<T>).detail);
  };
  
  element.addEventListener(name, listener);
  
  return () => {
    element.removeEventListener(name, listener);
  };
}

export function observeIntersection(
  element: HTMLElement,
  callback: (isIntersecting: boolean) => void,
  options?: IntersectionObserverInit
): () => void {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      callback(entry.isIntersecting);
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
    for (const entry of entries) {
      callback(entry);
    }
  });
  
  observer.observe(element);
  
  return () => {
    observer.disconnect();
  };
}