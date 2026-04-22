# 前端安全检查清单

## 目录

1. [XSS 防护](#xss-防护)
2. [CSRF 防护](#csrf-防护)
3. [敏感数据保护](#敏感数据保护)
4. [输入验证](#输入验证)
5. [权限控制](#权限控制)
6. [依赖安全](#依赖安全)

---

## XSS 防护

### dangerouslySetInnerHTML 使用

```typescript
// 危险：未净化用户输入
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// 推荐：使用 DOMPurify
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />

// 更好：避免使用，使用 React 的默认渲染
<div>{userInput}</div>
```

### URL 跳转

```typescript
// 危险：未验证的 URL 跳转
window.location.href = userInputUrl;

// 推荐：验证 URL 协议和域名
const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && allowedDomains.includes(parsed.hostname);
  } catch {
    return false;
  }
};

if (isValidUrl(userInputUrl)) {
  window.location.href = userInputUrl;
}
```

### 动态脚本执行

```typescript
// 危险：eval 和动态脚本
eval(userInput);
new Function(userInput);
document.write(userInput);

// 绝对避免！这些操作永远不应该在生产代码中使用
```

---

## CSRF 防护

### API 请求凭证

```typescript
// 推荐：使用 withCredentials
axios.defaults.withCredentials = true;

// 或在 fetch 中
fetch('/api/data', {
  credentials: 'include',
});
```

### CSRF Token

```typescript
// 推荐：在请求头中包含 CSRF Token
const csrfToken = getCsrfToken(); // 从 meta 标签或 cookie 获取

axios.post('/api/data', payload, {
  headers: {
    'X-CSRF-Token': csrfToken,
  },
});
```

---

## 敏感数据保护

### Token 存储

```typescript
// 危险：在 localStorage 存储敏感 Token
localStorage.setItem('token', token);

// 推荐：使用 httpOnly cookie（由服务器设置）
// 或使用短期内存存储，页面刷新后重新登录
const [token, setToken] = useState<string | null>(null);
```

### 日志输出

```typescript
// 危险：控制台输出敏感信息
console.log('User data:', userData);
console.log('Token:', authToken);

// 推荐：生产环境禁用 console
if (process.env.NODE_ENV !== 'production') {
  console.log('Debug info:', debugInfo);
}
```

### 错误信息

```typescript
// 危险：暴露堆栈跟踪给用户
showError(error.stack);

// 推荐：只显示用户友好的错误消息
showError('操作失败，请稍后重试');
// 详细错误只发送到日志服务
logError(error);
```

---

## 输入验证

### 表单验证

```typescript
// 推荐：前端验证（不能替代后端验证）
const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePassword = (password: string): boolean => {
  // 至少 8 位，包含大小写字母和数字
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return re.test(password);
};
```

### URL 参数验证

```typescript
// 危险：直接使用 URL 参数
const userId = new URLSearchParams(window.location.search).get('id');
fetch(`/api/user/${userId}`);

// 推荐：验证参数类型和范围
const userIdParam = new URLSearchParams(window.location.search).get('id');
const userId = parseInt(userIdParam || '', 10);
if (!isNaN(userId) && userId > 0) {
  fetch(`/api/user/${userId}`);
}
```

### 文件上传验证

```typescript
// 推荐：验证文件类型和大小
const validateFile = (file: File): boolean => {
  // 检查文件类型
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    return false;
  }

  // 检查文件大小（5MB 限制）
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return false;
  }

  return true;
};
```

---

## 权限控制

### 前端路由保护

```typescript
// 推荐：路由级别的权限检查
const ProtectedRoute = ({ children, requiredPermission }) => {
  const { user } = useAuth();
  const hasPermission = user?.permissions?.includes(requiredPermission);

  if (!hasPermission) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
};

// 使用
<Route
  path="/admin"
  element={
    <ProtectedRoute requiredPermission="admin">
      <AdminPage />
    </ProtectedRoute>
  }
/>
```

### UI 元素显示

```typescript
// 推荐：根据权限控制 UI 显示
const ActionBar = ({ user, resource }) => {
  const canEdit = hasPermission(user, 'edit', resource);
  const canDelete = hasPermission(user, 'delete', resource);

  return (
    <div>
      {canEdit && <Button>Edit</Button>}
      {canDelete && <Button>Delete</Button>}
    </div>
  );
};

// 注意：前端权限只是 UX 优化，后端必须验证
```

### API 请求权限

```typescript
// 推荐：检查操作权限后再请求
const deleteUser = async (userId: string) => {
  if (!hasPermission(user, 'delete', { type: 'user', id: userId })) {
    throw new Error('无权限执行此操作');
  }

  return api.delete(`/users/${userId}`);
};
```

---

## Content Security Policy

### CSP 配置

```typescript
// 推荐：配置 Content-Security-Policy 响应头
// 在 index.html 中添加 meta 标签（临时方案）
<meta
  httpEquiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://trusted.cdn.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://api.example.com;
  "
/>

// 更好：在服务器配置 CSP 响应头
```

---

## 依赖安全

### 检查依赖漏洞

```bash
# 使用 npm audit 检查漏洞
npm audit

# 使用 Snyk 进行更深入的安全检查
npm install -g snyk
snyk test
```

### 保持依赖更新

```bash
# 定期更新依赖
npm update

# 检查过时的依赖
npm outdated
```

### 使用 npm audit fix

```bash
# 自动修复可修复的漏洞
npm audit fix

# 强制修复（包括 breaking changes）
npm audit fix --force
```

---

## HTTPS 配置

### 强制 HTTPS

```typescript
// 推荐：在生产环境强制使用 HTTPS
if (process.env.NODE_ENV === 'production' && window.location.protocol !== 'https:') {
  window.location.href = window.location.href.replace(/^http:/, 'https:');
}
```

### Cookie 安全设置

```typescript
// 推荐：设置 Cookie 的安全属性（服务器端）
Set-Cookie: token=xyz; Secure; HttpOnly; SameSite=Strict

// Secure: 只通过 HTTPS 传输
// HttpOnly: 防止 XSS 访问
// SameSite: 防止 CSRF 攻击
```

---

## 安全响应头

### 推荐的安全响应头

```http
# 在服务器配置中添加

# 防止点击劫持
X-Frame-Options: DENY

# 防止 MIME 类型嗅探
X-Content-Type-Options: nosniff

# 启用浏览器 XSS 过滤器
X-XSS-Protection: 1; mode=block

# 限制来源信息
Referrer-Policy: strict-origin-when-cross-origin

# 权限策略
Permissions-Policy: geolocation=(), microphone=()
```

---

## 安全检查清单

在代码审查时，检查以下项目：

- [ ] 用户输入是否经过验证和净化？
- [ ] 是否使用了 `dangerouslySetInnerHTML`？是否使用了 DOMPurify？
- [ ] 敏感数据（Token、密码）是否安全存储？
- [ ] API 请求是否包含 CSRF Token？
- [ ] 权限检查是否在前端和后端都实现了？
- [ ] 是否有控制台日志泄露敏感信息？
- [ ] 文件上传是否验证了类型和大小？
- [ ] URL 参数是否经过验证？
- [ ] 是否配置了 Content-Security-Policy？
- [ ] 依赖是否有已知漏洞？
