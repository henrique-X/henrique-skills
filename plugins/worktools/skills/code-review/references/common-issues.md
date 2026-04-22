# 常见问题速查

## 目录

1. [React Hooks 问题](#react-hooks-问题)
2. [TypeScript 问题](#typescript-问题)
3. [性能问题](#性能问题)
4. [安全问题](#安全问题)
5. [异步处理问题](#异步处理问题)

---

## React Hooks 问题

### useEffect 依赖缺失

```typescript
// 错误：依赖数组缺少外部变量
useEffect(() => {
  fetchData(userId);
}, []); // 缺少 userId

// 正确
useEffect(() => {
  fetchData(userId);
}, [userId]);
```

### setState 闭包陷阱

```typescript
// 错误：setState 使用旧状态
setCount(count + 1);
setCount(count + 1); // 两次只增加 1

// 正确：使用函数式更新
setCount(c => c + 1);
setCount(c => c + 1);
```

### 条件 Hook 调用

```typescript
// 错误：条件调用 Hook
if (condition) {
  useEffect(() => {}, []);
}

// 正确：Hook 总是调用
useEffect(() => {
  if (condition) {
    // 逻辑
  }
}, []);
```

---

## TypeScript 问题

### any 滥用

```typescript
// 避免
const data: any = fetchData();

// 推荐
interface DataType {
  id: number;
  name: string;
}
const data: DataType = fetchData();

// 或使用 unknown（更安全）
const data: unknown = fetchData();
if (isDataType(data)) {
  // 使用 data
}
```

### 类型断言过度

```typescript
// 避免：盲目断言
const el = document.getElementById('my-div') as HTMLInputElement;

// 推荐：类型守卫
const el = document.getElementById('my-div');
if (el instanceof HTMLInputElement) {
  // 使用 el
}
```

---

## 性能问题

### 不必要的 re-render

```typescript
// 问题：父组件更新导致子组件无效重渲染
const Child = ({ data, onClick }) => {
  return <div onClick={onClick}>{data.name}</div>;
};

// 解决：使用 React.memo 或拆分 props
const Child = React.memo(({ data, onClick }) => {
  return <div onClick={onClick}>{data.name}</div>;
});
```

### 内联函数导致重渲染

```typescript
// 问题：每次渲染创建新函数
<Component onClick={() => handleClick(id)} />

// 解决：使用 useCallback
const handleClickMemoized = useCallback(() => handleClick(id), [id]);
<Component onClick={handleClickMemoized} />
```

### 大列表渲染

```typescript
// 问题：渲染大列表性能差
{items.map(item => <Item key={item.id} data={item} />)}

// 解决：使用虚拟化列表
import { FixedSizeList } from 'react-window';
<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={50}
>
  {({ index, style }) => <Item style={style} data={items[index]} />}
</FixedSizeList>
```

---

## 安全问题

### XSS 风险

```typescript
// 危险：直接渲染用户输入
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// 安全：使用 DOMPurify
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
// 或更好的方式：避免使用 dangerouslySetInnerHTML
```

### URL 参数注入

```typescript
// 危险：未编码直接拼接
const url = `/api/user/${userId}`;

// 安全：使用编码
const url = `/api/user/${encodeURIComponent(userId)}`;
```

---

## 异步处理问题

### Promise 错误未捕获

```typescript
// 问题：没有错误处理
fetch('/api/data').then(res => res.json());

// 解决：添加 catch
fetch('/api/data')
  .then(res => res.json())
  .catch(err => console.error(err));

// 或使用 async/await
try {
  const res = await fetch('/api/data');
  const data = await res.json();
} catch (err) {
  console.error(err);
}
```

### 竞态条件

```typescript
// 问题：快速连续请求，结果顺序不确定
const fetchData = async (id: number) => {
  const res = await fetch(`/api/data/${id}`);
  return res.json();
};

// 解决：使用 AbortController 或请求序列号
const fetchData = (id: number) => {
  const controller = new AbortController();
  return {
    promise: fetch(`/api/data/${id}`, { signal: controller.signal }),
    abort: () => controller.abort()
  };
};
```

---

## 内存泄漏

### 事件监听未清理

```typescript
// 问题：组件卸载后监听器仍然存在
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);

// 解决：返回清理函数
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

### 定时器未清理

```typescript
// 问题：组件卸载后定时器仍在运行
useEffect(() => {
  setInterval(() => {
    console.log('tick');
  }, 1000);
}, []);

// 解决：返回清理函数
useEffect(() => {
  const interval = setInterval(() => {
    console.log('tick');
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

---

## 边界条件问题

### 数组越界

```typescript
// 问题：数组可能为空
const first = items[0];

// 解决：添加检查
const first = items?.[0];
const first = items.length > 0 ? items[0] : undefined;
```

### 可选链最佳实践

```typescript
// 推荐：使用可选链
const name = user?.profile?.name;
const item = items?.[index];

// 避免：过深的可选链影响可读性
const val = a?.b?.c?.d?.e;
// 考虑拆分
const b = a?.b;
const c = b?.c;
```

---

## 其他常见问题

### 魔法数字

```typescript
// 问题：硬编码数字
if (status === 200) {
  // ...
}

// 解决：定义常量
const HTTP_STATUS_OK = 200;
if (status === HTTP_STATUS_OK) {
  // ...
}
```

### 重复代码

```typescript
// 问题：重复逻辑
const handleA = () => {
  setLoading(true);
  try {
    await fetchA();
  } finally {
    setLoading(false);
  }
};

const handleB = () => {
  setLoading(true);
  try {
    await fetchB();
  } finally {
    setLoading(false);
  }
};

// 解决：抽取公共逻辑
const withLoading = async (fn: () => Promise<void>) => {
  setLoading(true);
  try {
    await fn();
  } finally {
    setLoading(false);
  }
};

const handleA = () => withLoading(fetchA);
const handleB = () => withLoading(fetchB);
```
