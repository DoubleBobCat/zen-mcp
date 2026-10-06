# 事件规格

[English](Event-Spec.md) | [简体中文](Event-Spec_zh.md)

## 公共事件

当前运行时不提供公共 MCP 事件流或订阅 API。MCP 通信基于请求/响应，不存在额外的事件传输实现。

## 内部生命周期事件

会话清理后，bridge 向扩展发送以下内部控制消息：

```json
{
  "type": "zen/session-disconnected",
  "sessionId": "session-id"
}
```

扩展还会消费 `tabs.onRemoved`、WebSocket open/close/error 和 `webRequest` 请求生命周期等浏览器事件。这些是实现细节，不是可调用的 MCP 事件。

## 兼容性规则

增加公共事件或订阅契约前，必须先创建新的规格、工具注册、测试和 API 文档，再进行实现。
