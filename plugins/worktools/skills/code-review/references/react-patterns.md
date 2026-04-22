# React 最佳实践

## 目录

1. [组件设计](#组件设计)
2. [状态管理](#状态管理)
3. [性能优化](#性能优化)
4. [Hooks 模式](#hooks-模式)
5. [类型定义](#类型定义)

---

## 组件设计

### 单一职责

```typescript
// 推荐：组件只做一件事
const UserAvatar = ({ src, alt }) => <img src={src} alt={alt} />;
const UserInfo = ({ name, email }) => (
  <div>
    <h2>{name}</h2>
    <p>{email}</p>
  </div>
);
const UserProfile = ({ user }) => (
  <div>
    <UserAvatar src={user.avatar} alt={user.name} />
    <UserInfo name={user.name} email={user.email} />
  </div>
);

// 避免：一个组件做太多事
const UserProfile = ({ user }) => (
  <div className="profile">
    <img src={user.avatar} alt={user.name} className="avatar" />
    <h2>{user.name}</h2>
    <p>{user.email}</p>
    <button onClick={() => editUser(user.id)}>Edit</button>
    <button onClick={() => deleteUser(user.id)}>Delete</button>
    {/* ... 更多功能 */}
  </div>
);
```

### Props 接口设计

```typescript
// 推荐：清晰的 Props 接口
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
};
```

### 组件组合

```typescript
// 推荐：使用组合而非 props 嵌套
const Card = ({ children, header, footer }) => (
  <div className="card">
    {header && <div className="card-header">{header}</div>}
    <div className="card-body">{children}</div>
    {footer && <div className="card-footer">{footer}</div>}
  </div>
);

// 使用
<Card
  header={<h2>Title</h2>}
  footer={<Button>Save</Button>}
>
  <p>Content</p>
</Card>
```

---

## 状态管理

### 状态提升

```typescript
// 推荐：共享状态提升到最近的共同父组件
const ParentComponent = () => {
  const [count, setCount] = useState(0);
  return (
    <>
      <ChildA count={count} onIncrement={() => setCount(c => c + 1)} />
      <ChildB count={count} />
    </>
  );
};
```

### 使用 useReducer 管理复杂状态

```typescript
// 推荐：复杂状态使用 useReducer
type State = {
  count: number;
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: number }
  | { type: 'FETCH_ERROR'; payload: string };

const initialState: State = {
  count: 0,
  loading: false,
  error: null,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, count: action.payload };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

const Component = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  // ...
};
```

### Context 使用

```typescript
// 推荐：Context 只存储必要的、变化不频繁的数据
const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const toggleTheme = () => {
    setTheme(t => (t === 'light' ? 'dark' : 'light'));
  };
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

---

## 性能优化

### React.memo

```typescript
// 推荐：纯组件使用 memo
const ExpensiveComponent = React.memo(({ data, onAction }) => {
  // 渲染逻辑
});

// 注意：避免不必要的 memo
// 如果组件经常更新，memo 可能反而降低性能
```

### useMemo

```typescript
// 推荐：昂贵的计算使用 useMemo
const sortedList = useMemo(() => {
  return items.sort((a, b) => a.value - b.value);
}, [items]);

// 避免：过度使用 useMemo
// 简单计算不需要 useMemo
const doubled = value * 2; // 不需要 useMemo
```

### useCallback

```typescript
// 推荐：传递给子组件的回调使用 useCallback
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// 注意：依赖项变化时，回调仍会重新创建
```

---

## Hooks 模式

### 自定义 Hook

```typescript
// 推荐：抽取可复用的逻辑为自定义 Hook
const useFetch = <T>(url: string) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(url);
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [url]);

  return { data, loading, error };
};

// 使用
const { data, loading, error } = useFetch<User>('/api/user/1');
```

### useRef 使用场景

```typescript
// 1. DOM 引用
const inputRef = useRef<HTMLInputElement>(null);
const focusInput = () => inputRef.current?.focus();

// 2. 保持可变值（不触发重渲染）
const timerRef = useRef<NodeJS.Timeout>();
useEffect(() => {
  timerRef.current = setInterval(() => {}, 1000);
  return () => clearInterval(timerRef.current);
}, []);

// 3. 存储上一次的值
const prevValueRef = useRef<T>();
useEffect(() => {
  prevValueRef.current = value;
}, [value]);
```

---

## 类型定义

### 组件 Props 类型

```typescript
// 推荐：使用 interface 定义 Props
interface CardProps {
  title: string;
  description?: string;
  onEdit?: () => void;
}

const Card: React.FC<CardProps> = ({ title, description, onEdit }) => {
  return (
    <div className="card">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {onEdit && <button onClick={onEdit}>Edit</button>}
    </div>
  );
};

// 或使用类型别名
type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
};
```

### 泛型组件

```typescript
// 推荐：可复用组件使用泛型
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string | number;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map(item => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

// 使用
<List
  items={users}
  renderItem={user => <span>{user.name}</span>}
  keyExtractor={user => user.id}
/>
```

---

## 错误处理

### Error Boundary

```typescript
// 推荐：使用 Error Boundary 捕获组件错误
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}
```

---

## 样式最佳实践

### CSS Modules

```typescript
// 推荐：使用 CSS Modules 避免样式冲突
import styles from './Button.module.css';

const Button = ({ children }) => {
  return <button className={styles.button}>{children}</button>;
};
```

### Styled Components

```typescript
// 推荐：使用 styled-components
import styled from 'styled-components';

const StyledButton = styled.button`
  padding: 10px 20px;
  background: ${props => props.primary ? 'blue' : 'gray'};
  color: white;
`;
```

---

## 测试建议

### 组件测试

```typescript
// 推荐：测试关键行为和交互
describe('Button', () => {
  it('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when loading', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```
