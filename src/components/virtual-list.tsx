import { useState } from 'react';

/**
 * 轻量虚拟滚动列表：行高固定，滚动时只渲染可视窗口 ± overscan。
 *
 * 块的模型与密钥都可能上百条，普通渲染会拖慢弹窗；这里不引依赖，
 * 固定行高换窗口化，够用就好。
 */
export function VirtualList<T>({
  items,
  itemHeight,
  maxHeight = 240,
  getItemKey,
  renderItem,
  empty,
  resetKey,
  overscan = 8,
}: {
  items: T[];
  itemHeight: number;
  /** 滚动容器的最大高度；条目少时按实际高度收缩。 */
  maxHeight?: number;
  getItemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  empty?: React.ReactNode;
  /** 变化时重置滚动位置（比如筛选词换了）。 */
  resetKey?: string;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  if (items.length === 0) return <>{empty ?? null}</>;

  const height = Math.min(maxHeight, items.length * itemHeight);
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const end = Math.min(items.length, start + Math.ceil(height / itemHeight) + overscan * 2);

  return (
    <div
      key={resetKey}
      className="overflow-y-auto"
      style={{ height }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div className="relative" style={{ height: items.length * itemHeight }}>
        {items.slice(start, end).map((item, i) => {
          const index = start + i;
          return (
            <div
              key={getItemKey(item, index)}
              className="absolute right-0 left-0 flex items-center"
              style={{ top: index * itemHeight, height: itemHeight }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
