export interface VirtualListConfig<T> {
  container: HTMLElement;
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => HTMLElement;
  keyFn: (item: T, index: number) => string;
  overscan?: number;
}

export interface VirtualListInstance<T> {
  update: (items: T[]) => void;
  scrollToIndex: (index: number) => void;
  destroy: () => void;
}

export function createVirtualList<T>(config: VirtualListConfig<T>): VirtualListInstance<T> {
  const { container, itemHeight, renderItem, keyFn, overscan = 3 } = config;
  let items = config.items;
  
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.width = '100%';
  wrapper.style.overflow = 'auto';
  wrapper.style.contain = 'strict';
  wrapper.className = 'no-scrollbar';
  
  const spacer = document.createElement('div');
  spacer.style.position = 'absolute';
  spacer.style.top = '0';
  spacer.style.left = '0';
  spacer.style.width = '100%';
  spacer.style.pointerEvents = 'none';
  
  const content = document.createElement('div');
  content.style.position = 'absolute';
  content.style.top = '0';
  content.style.left = '0';
  content.style.width = '100%';
  content.style.willChange = 'transform';
  
  wrapper.appendChild(spacer);
  wrapper.appendChild(content);
  container.appendChild(wrapper);
  
  const renderedElements = new Map<string, HTMLElement>();
  let currentStartIndex = 0;
  let currentEndIndex = 0;
  let rafId: number | null = null;
  
  const getContainerHeight = (): number => {
    const style = getComputedStyle(container);
    const maxHeight = style.maxHeight;
    if (maxHeight && maxHeight !== 'none') {
      return parseInt(maxHeight, 10);
    }
    return container.clientHeight || 320;
  };
  
  const render = (): void => {
    const containerHeight = getContainerHeight();
    const scrollTop = wrapper.scrollTop;
    const totalHeight = items.length * itemHeight;
    
    spacer.style.height = totalHeight + 'px';
    
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(items.length, Math.floor(scrollTop / itemHeight) + visibleCount + overscan);
    
    if (startIndex === currentStartIndex && endIndex === currentEndIndex && renderedElements.size > 0) {
      return;
    }
    
    currentStartIndex = startIndex;
    currentEndIndex = endIndex;
    
    const newKeys = new Set<string>();
    for (let i = startIndex; i < endIndex; i++) {
      const key = keyFn(items[i], i);
      newKeys.add(key);
    }
    
    renderedElements.forEach((el, key) => {
      if (!newKeys.has(key)) {
        el.remove();
        renderedElements.delete(key);
      }
    });
    
    for (let i = startIndex; i < endIndex; i++) {
      const item = items[i];
      const key = keyFn(item, i);
      
      if (!renderedElements.has(key)) {
        const el = renderItem(item, i);
        el.style.position = 'absolute';
        el.style.top = (i * itemHeight) + 'px';
        el.style.left = '0';
        el.style.width = '100%';
        el.style.height = itemHeight + 'px';
        el.style.boxSizing = 'border-box';
        content.appendChild(el);
        renderedElements.set(key, el);
      } else {
        const el = renderedElements.get(key)!;
        el.style.top = (i * itemHeight) + 'px';
      }
    }
  };
  
  const scheduleRender = (): void => {
    if (rafId !== null) {
      return;
    }
    rafId = requestAnimationFrame(() => {
      rafId = null;
      render();
    });
  };
  
  const handleScroll = (): void => {
    scheduleRender();
  };
  
  wrapper.addEventListener('scroll', handleScroll, { passive: true });
  
  render();
  
  return {
    update: (newItems: T[]): void => {
      items = newItems;
      renderedElements.forEach((el) => el.remove());
      renderedElements.clear();
      currentStartIndex = 0;
      currentEndIndex = 0;
      render();
    },
    scrollToIndex: (index: number): void => {
      wrapper.scrollTop = index * itemHeight;
    },
    destroy: (): void => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      wrapper.removeEventListener('scroll', handleScroll);
      renderedElements.forEach((el) => el.remove());
      renderedElements.clear();
      wrapper.remove();
    }
  };
}
