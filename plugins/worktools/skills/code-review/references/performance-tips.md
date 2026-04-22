# 性能优化技巧

## 目录

1. [渲染优化](#渲染优化)
2. [代码分割](#代码分割)
3. [资源优化](#资源优化)
4. [打包优化](#打包优化)
5. [运行时优化](#运行时优化)

---

## 渲染优化

### 避免不必要的重渲染

```typescript
// 问题：父组件更新导致所有子组件重渲染
const Parent = ({ items }) => {
  const [filter, setFilter] = useState('');
  return (
    <>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      {items.map(item => (
        <Item key={item.id} data={item} />
      ))}
    </>
  );
};

// 解决：使用 React.memo 或拆分状态
const Item = React.memo(({ data }) => {
  return <div>{data.name}</div>;
});

// 更好：将频繁变化的状态移到子组件
const Parent = ({ items }) => {
  return (
    <>
      <FilterInput />
      <ItemList items={items} />
    </>
  );
};
```

### 列表渲染优化

```typescript
// 问题：缺少 key 或 key 不稳定
{items.map((item, index) => (
  <Item key={index} data={item} />
))}

// 推荐：使用稳定的唯一标识符
{items.map(item => (
  <Item key={item.id} data={item} />
))}

// 虚拟滚动（大列表）
import { FixedSizeList } from 'react-window';

const VirtualList = ({ items }) => (
  <FixedSizeList
    height={600}
    itemCount={items.length}
    itemSize={50}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>{items[index].name}</div>
    )}
  </FixedSizeList>
);
```

### 防抖和节流

```typescript
// 推荐：使用防抖处理频繁事件
import { useDebouncedCallback } from 'use-debounce';

const SearchInput = () => {
  const debouncedSearch = useDebouncedCallback(
    (value) => {
      search(value);
    },
    500,
    { leading: false, trailing: true }
  );

  return <input onChange={e => debouncedSearch(e.target.value)} />;
};

// 节流：限制执行频率
import { useThrottledCallback } from 'use-debounce';

const ScrollHandler = () => {
  const throttledHandle = useThrottledCallback(
    () => {
      handleScroll();
    },
    100,
    { leading: true, trailing: false }
  );

  useEffect(() => {
    window.addEventListener('scroll', throttledHandle);
    return () => window.removeEventListener('scroll', throttledHandle);
  }, [throttledHandle]);
};
```

---

## 代码分割

### 路由级别分割

```typescript
// 推荐：使用 React.lazy 懒加载路由组件
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

const App = () => (
  <Suspense fallback={<Loading />}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  </Suspense>
);
```

### 组件级别分割

```typescript
// 推荐：非首屏组件使用懒加载
const HeavyComponent = lazy(() => import('./HeavyComponent'));

const Page = () => {
  const [showHeavy, setShowHeavy] = useState(false);

  return (
    <div>
      <button onClick={() => setShowHeavy(true)}>Show</button>
      {showHeavy && (
        <Suspense fallback={<Loading />}>
          <HeavyComponent />
        </Suspense>
      )}
    </div>
  );
};
```

### 动态导入

```typescript
// 推荐：用户交互时才加载模块
const loadModule = async () => {
  const { default: Module } = await import('./heavy-module');
  Module.doSomething();
};

<button onClick={loadModule}>Load Module</button>
```

---

## 资源优化

### 图片优化

```typescript
// 推荐：使用 WebP 格式 + 响应式图片
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <source srcSet="image.jpg" type="image/jpeg" />
  <img src="image.jpg" alt="Description" loading="lazy" />
</picture>

// 使用 next/image 或类似组件
import Image from 'next/image';

<Image
  src="/image.jpg"
  alt="Description"
  width={500}
  height={300}
  loading="lazy"
/>
```

### 字体优化

```css
/* 推荐：使用 font-display */
@font-face {
  font-family: 'CustomFont';
  src: url('./font.woff2') format('woff2');
  font-display: swap; /* 避免不可见文本闪烁 */
}

/* 预加载关键字体 */
<link
  rel="preload"
  href="/fonts/critical.woff2"
  as="font"
  type="font/woff2"
  crossOrigin="anonymous"
/>
```

### CDN 资源

```typescript
// 推荐：静态资源使用 CDN
const config = {
  CDN_URL: 'https://cdn.example.com',
  getAssetPath: (path: string) => `${config.CDN_URL}/${path}`
};

<img src={config.getAssetPath('image.jpg')} alt="" />
```

---

## 打包优化

### Tree Shaking

```typescript
// 推荐：按需导入
import { debounce } from 'lodash-es'; // 使用 lodash-es 支持 tree shaking

// 避免：导入整个库
import _ from 'lodash';
```

### 依赖分析

```bash
# 分析打包体积
npm run build -- --analyze

# 或使用 webpack-bundle-analyzer
npm install --save-dev webpack-bundle-analyzer
```

### Polyfill 策略

```typescript
// 推荐：按需添加 polyfill
import 'core-js/actual/array/find';
import 'core-js/actual/promise';

// 避免：导入整个 core-js
import 'core-js';
```

---

## 运行时优化

### useMemo 缓存计算结果

```typescript
// 推荐：昂贵的计算使用 useMemo
const sortedList = useMemo(() => {
  return items.sort((a, b) => a.value - b.value);
}, [items]);

// 避免：简单的计算不需要 useMemo
const doubled = value * 2; // 不需要 useMemo
```

### useCallback 稳定引用

```typescript
// 推荐：传递给子组件的回调使用 useCallback
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// 注意：依赖项变化时仍会创建新函数
```

### 状态更新批处理

```typescript
// React 18 自动批处理
const handleClick = () => {
  setCount(c => c + 1); // 不会立即重渲染
  setValue(v => v + 1); // 不会立即重渲染
  // 两个状态更新会被批处理，只重渲染一次
};

// React 17 需要手动批处理
import { unstable_batchedUpdates } from 'react-dom';

unstable_batchedUpdates(() => {
  setCount(c => c + 1);
  setValue(v => v + 1);
});
```

---

## 内存优化

### 清理副作用

```typescript
// 推荐：useEffect 返回清理函数
useEffect(() => {
  const subscription = dataSource.subscribe();
  return () => {
    subscription.unsubscribe(); // 清理订阅
  };
}, []);

// 清理事件监听
useEffect(() => {
  const handleResize = () => {};
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

### 避免内存泄漏

```typescript
// 问题：组件卸载后 setState
useEffect(() => {
  const fetchData = async () => {
    const data = await api.getData();
    setState(data); // 组件可能已卸载
  };
  fetchData();
}, []);

// 解决：使用取消标志
useEffect(() => {
  let cancelled = false;
  const fetchData = async () => {
    const data = await api.getData();
    if (!cancelled) {
      setState(data);
    }
  };
  fetchData();
  return () => {
    cancelled = true;
  };
}, []);

// 或使用 AbortController
useEffect(() => {
  const controller = new AbortController();
  const fetchData = async () => {
    const data = await api.getData({ signal: controller.signal });
    setState(data);
  };
  fetchData();
  return () => {
    controller.abort();
  };
}, []);
```

---

## 性能监控

### 测量渲染性能

```typescript
// 使用 React DevTools Profiler
import { Profiler } from 'react';

<Profiler id="MyComponent" onRender={onRenderCallback}>
  <MyComponent />
</Profiler>;

const onRenderCallback = (
  id, phase, actualDuration, baseDuration, startTime, commitTime
) => {
  if (actualDuration > 16) { // 超过一帧（60fps）
    console.warn(`${id} ${phase} took ${actualDuration}ms`);
  }
};
```

### Web Vitals 监控

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

---

## 性能检查清单

代码审查时检查以下项目：

- [ ] 是否有不必要的重渲染？
- [ ] 大列表是否使用了虚拟滚动？
- [ ] 频繁事件是否使用了防抖/节流？
- [ ] 路由组件是否使用了懒加载？
- [ ] 图片是否使用了懒加载和优化格式？
- [ ] 是否正确使用了 useMemo 和 useCallback？
- [ ] useEffect 是否正确清理副作用？
- [ ] 是否有内存泄漏风险？
- [ ] 打包体积是否过大？
- [ ] 第三方库是否按需导入？
