"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { z } from "zod";
import dynamic from "next/dynamic";
import { ArrowLeftRight, Menu, Copy, ChevronDown, ChevronRight, Bookmark, Map, Settings } from "lucide-react";
import { toast } from "sonner"
import "./minimap.css";
// 动态导入 Monaco Editor 以避免 SSR 问题
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// 定义 Schema 对象的类型
const SchemaObject: z.ZodType<any> = z.object({
  type: z.string().optional(),
  format: z.string().optional(),
  properties: z.record(z.lazy(() => SchemaObject)).optional(),
  items: z.lazy(() => SchemaObject.or(z.object({ $ref: z.string() }))).optional(),
  $ref: z.string().optional(),
  example: z.unknown().optional(),
  enum: z.array(z.unknown()).optional(),
  required: z.array(z.string()).optional(),
});


// 定义操作对象的类型
const OperationObjectSchema = z.object({
  summary: z.string().optional(),
  description: z.string().optional(),
  operationId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  parameters: z.array(z.object({
    name: z.string(),
    in: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    schema: SchemaObject,
    example: z.unknown().optional(),
  })).optional(),
  requestBody: z.object({
    content: z.record(z.object({
      schema: SchemaObject.or(z.object({ $ref: z.string() })),
      example: z.unknown().optional(),
      examples: z.record(z.unknown()).optional(),
    })),
    required: z.boolean().optional(),
    description: z.string().optional(),
  }).optional(),
  responses: z.record(z.object({
    description: z.string().optional(),
    content: z.record(z.object({
      schema: SchemaObject.or(z.object({ $ref: z.string() })),
      example: z.unknown().optional(),
      examples: z.record(z.unknown()).optional(),
    })).optional(),
  })),
});

type OperationObject = z.infer<typeof OperationObjectSchema>;
type Parameter = {
  name: string;
  in: string;
  description?: string;
  required?: boolean;
  schema: { type?: string };
};

type RequestBody = {
  content: Record<string, {
    schema: { type?: string };
    example?: unknown;
    examples?: Record<string, unknown>;
  }>;
  required?: boolean;
  description?: string;
};

// 基本的 OpenAPI Schema 验证器
const OpenAPISchema = z.object({
  openapi: z.string().optional(),
  swagger: z.string().optional(),
  info: z.object({
    title: z.string(),
    version: z.string(),
    description: z.string().optional(),
  }),
  tags: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
    })
  ).optional(),
  paths: z.record(z.record(OperationObjectSchema)),
  components: z.object({
    schemas: z.record(SchemaObject),
    securitySchemes: z.record(z.unknown()).optional(),
  }).optional(),
});

type OpenAPIDocument = z.infer<typeof OpenAPISchema>;

export default function OpenAPIPage() {
  const [apiDoc, setApiDoc] = useState<OpenAPIDocument | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // 初始宽度百分比
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [collapsedTags, setCollapsedTags] = useState<Record<string, boolean>>({});
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const tagRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [isMinimapVisible, setIsMinimapVisible] = useState(false);
  const [hoveredCopyItem, setHoveredCopyItem] = useState<string | null>(null);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copyWithDesc, setCopyWithDesc] = useState(false);

  // 从 localStorage 加载数据
  useEffect(() => {
    const savedData = localStorage.getItem('openapi-viewer-state');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData) as {
          inputValue: string;
          leftPanelWidth: number;
          isLeftPanelCollapsed: boolean;
          collapsedTags: Record<string, boolean>;
          isNavVisible: boolean;
        };

        setInputValue(parsedData.inputValue ?? "");
        setLeftPanelWidth(parsedData.leftPanelWidth ?? 50);
        setIsLeftPanelCollapsed(parsedData.isLeftPanelCollapsed ?? false);
        setCollapsedTags(parsedData.collapsedTags ?? {});
        setIsNavVisible(parsedData.isNavVisible ?? true);

        // 如果有保存的API文档，尝试解析
        if (parsedData.inputValue) {
          parseOpenAPI(parsedData.inputValue);
        }
      } catch (e) {
        console.error('Error loading saved state:', e);
      }
    }
  }, []);

  // 保存状态到 localStorage
  useEffect(() => {
    const state = {
      inputValue,
      leftPanelWidth,
      isLeftPanelCollapsed,
      collapsedTags,
      isNavVisible
    };
    localStorage.setItem('openapi-viewer-state', JSON.stringify(state));
  }, [inputValue, leftPanelWidth, isLeftPanelCollapsed, collapsedTags, isNavVisible]);

  // 解析 OpenAPI JSON
  const parseOpenAPI = useCallback((jsonContent: string) => {
    try {
      setError(null);
      const parsed = JSON.parse(jsonContent) as OpenAPIDocument;
      const validated = OpenAPISchema.parse(parsed);
      setApiDoc(validated);
      setInputValue(jsonContent);

      // 初始化所有标签为展开状态
      if (validated.paths) {
        const tags = new Set<string>();
        const defaultTag = "default";

        Object.values(validated.paths).forEach(methods => {
          Object.values(methods).forEach(operation => {
            if (operation.tags && operation.tags.length > 0) {
              operation.tags.forEach(tag => tags.add(tag));
            } else {
              tags.add(defaultTag);
            }
          });
        });

        // 重置折叠状态
        const newCollapsedState: Record<string, boolean> = {};
        tags.forEach(tag => {
          newCollapsedState[tag] = false;
        });
        setCollapsedTags(newCollapsedState);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "无效的 OpenAPI 文档");
      setApiDoc(null);
    }
  }, []);

  // 处理 Monaco Editor 内容变更
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setInputValue(value);
    }
  }, []);

  // 使用 useEffect 来防抖处理解析操作
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue.trim()) {
        parseOpenAPI(inputValue);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [inputValue, parseOpenAPI]);

  // 处理拖动事件
  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;

    // 添加事件处理程序到 document 以处理鼠标移动和释放
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const xPosition = e.clientX - containerRect.left;

      // 计算左侧面板宽度的百分比（限制在10%-90%之间）
      const newWidthPercent = Math.min(Math.max((xPosition / containerWidth) * 100, 10), 90);

      setLeftPanelWidth(newWidthPercent);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none'; // 防止文本选择
  }, []);

  // 处理文件上传
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInputValue(content);
      // 直接设置 inputValue，让 useEffect 处理解析
    };
    reader.readAsText(file);
  }, []);

  // 处理拖放
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInputValue(content);
      // 直接设置 inputValue，让 useEffect 处理解析
    };
    reader.readAsText(file);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  // 折叠/展开左侧面板
  const toggleLeftPanel = useCallback(() => {
    setIsLeftPanelCollapsed(prev => !prev);
  }, []);

  // 修改复制函数，支持添加描述
  const copyToClipboard = useCallback((text: string | Parameter, type?: string) => {
    let finalText: string;

    if (typeof text === 'object' && type === 'param-row') {
      const param = text;
      const parts = [];
      if (param.name) parts.push(`参数名: ${param.name}`);
      if (param.in) parts.push(`位置: ${param.in}`);
      if (param.schema?.type) parts.push(`类型: ${param.schema.type}`);
      if (param.required !== undefined) parts.push(`必填: ${param.required ? 'true' : 'false'}`);
      if (param.description) parts.push(`描述: ${param.description}`);
      finalText = parts.join('\n');
    } else {
      finalText = typeof text === 'string' ? text : JSON.stringify(text);
      if (copyWithDesc && type) {
        switch (type) {
          case 'url':
            finalText = `url: ${finalText}`;
            break;
          case 'summary':
            finalText = `摘要: ${finalText}`;
            break;
          case 'request':
            finalText = `请求示例:\n${finalText}`;
            break;
          case 'response':
            finalText = `响应示例:\n${finalText}`;
            break;
          default:
            break;
        }
      }
    }

    navigator.clipboard.writeText(finalText).then(
      () => {
        toast.success('已复制到剪贴板')
      },
      (err) => {
        console.error('无法复制文本: ', err);
      }
    );
  }, [copyWithDesc]);

  // 切换标签的折叠状态
  const toggleTagCollapse = useCallback((tag: string) => {
    setCollapsedTags(prev => ({
      ...prev,
      [tag]: !prev[tag]
    }));
  }, []);

  // 滚动到特定标签
  const scrollToTag = useCallback((tag: string) => {
    if (tagRefs.current[tag]) {
      tagRefs.current[tag]?.scrollIntoView({ behavior: 'smooth' });

      // 确保标签是展开的
      setCollapsedTags(prev => ({
        ...prev,
        [tag]: false
      }));
    }
  }, []);

  // 将 API 路径按 tag 分组，使用 useMemo 缓存结果
  const pathsByTag = useMemo(() => {
    if (!apiDoc) return {};

    const result: Record<string, { path: string; method: string; operation: OperationObject }[]> = {};
    const defaultTag = "default";

    Object.entries(apiDoc.paths).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, operation]) => {
        const tags = operation.tags ?? [defaultTag];

        tags.forEach((tag) => {
          result[tag] ??= [];

          result[tag].push({
            path,
            method,
            operation,
          });
        });
      });
    });

    return result;
  }, [apiDoc]);

  // 切换 minimap 显示状态
  const toggleMinimap = useCallback(() => {
    setIsMinimapVisible(prev => !prev);
  }, []);

  // 设置悬停的可复制项
  const handleCopyItemHover = useCallback((id: string | null) => {
    setHoveredCopyItem(id);
  }, []);

  // 解析 schema 引用
  const resolveSchemaRef = (ref: string) => {
    if (!ref.startsWith('#/components/schemas/')) return null;
    const schemaName = ref.replace('#/components/schemas/', '');
    return apiDoc?.components?.schemas?.[schemaName];
  };

  // 路径项组件 - 提取为单独组件以优化渲染
  const PathItem = ({ item }: { item: { path: string; method: string; operation: OperationObject } }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // 格式化 JSON 显示
    const formatJSON = (obj: unknown): string => {
      try {
        return JSON.stringify(obj, null, 2);
      } catch (e) {
        return '无效的 JSON 数据';
      }
    };

    // 获取请求体示例
    const getRequestExample = () => {

      if (!item.operation.requestBody?.content) return null;

      const firstContentType = Object.entries(item.operation.requestBody.content)[0];
      if (!firstContentType) return null;

      const [contentType, content] = firstContentType;


      return {
        contentType,
        example: content.example ?? (content.examples ? Object.values(content.examples)[0] : null),
      };
    };

    // 获取响应示例
    const getResponseExample = () => {
      const successResponse = Object.entries(item.operation.responses)
        .find(([code]) => code.startsWith('2'));

      if (!successResponse) return null;

      const [code, response] = successResponse;
      if (!response.content) return null;

      const firstContentType = Object.entries(response.content)[0];
      if (!firstContentType) return null;

      const [contentType, content] = firstContentType;

      // 首先检查直接的 example
      if (content.example) {
        return {
          code,
          contentType,
          example: content.example
        };
      }

      // 然后检查 examples
      if (content.examples) {
        const firstExample = Object.values(content.examples)[0];
        if (firstExample && typeof firstExample === 'object') {
          // 如果有 value 字段，使用它
          if ('value' in firstExample) {
            return {
              code,
              contentType,
              example: firstExample.value
            };
          }
          // 否则使用整个示例对象
          return {
            code,
            contentType,
            example: firstExample
          };
        }
      }

      // 最后尝试从 schema 生成示例
      if (content.schema) {
        return {
          code,
          contentType,
          example: generateExampleFromSchema(content.schema)
        };
      }

      return null;
    };

    // 获取默认示例
    const getDefaultExample = () => {
      // 如果有请求体示例，使用它
      const requestExample = getRequestExample();
      if (requestExample?.example) {
        return requestExample.example;
      }

      // 从 schema 生成示例
      if (item.operation.requestBody?.content?.['application/json']?.schema?.$ref) {
        const ref = item.operation.requestBody.content['application/json'].schema.$ref;
        const schemaName = ref.replace('#/components/schemas/', '');
        const schema = apiDoc?.components?.schemas?.[schemaName];
        if (schema) {
          return generateExampleFromSchema(schema);
        }
      }

      return null;
    };

    // 从 schema 生成示例值
    const generateExampleFromSchema = (schema: any): any => {
      if (!schema) return null;

      // 如果有预定义的示例
      if (schema.example !== undefined) {
        return schema.example;
      }

      if (schema.type === 'object' && schema.properties) {
        const result: Record<string, any> = {};
        const properties = schema.properties as Record<string, Record<string, unknown>>;
        for (const [key, prop] of Object.entries(properties)) {
          result[key] = generateExampleFromSchema(prop);
        }
        return result;
      }

      if (schema.type === 'array' && schema.items) {
        if (schema.items.$ref) {
          const schemaName = schema.items.$ref.replace('#/components/schemas/', '');
          const itemSchema = apiDoc?.components?.schemas?.[schemaName];
          if (itemSchema) {
            return [generateExampleFromSchema(itemSchema)];
          }
        }
        return [generateExampleFromSchema(schema.items)];
      }

      // 基础类型的默认值
      switch (schema.type) {
        case 'string':
          if (schema.format === 'date') return "2025-04-18";
          if (schema.format === 'date-time') return "2025-04-18T00:00:00";
          if (schema.enum?.length > 0) return schema.enum[0];
          return "string";
        case 'number':
        case 'integer':
          return 0;
        case 'boolean':
          return false;
        default:
          return null;
      }
    };

    const requestExample = getDefaultExample();

    const responseExample = getResponseExample();

    // 复制所有可用数据
    const copyAllData = () => {
      const parts: string[] = [];

      // URL
      parts.push(`URL: ${item.method.toUpperCase()} ${item.path}`);

      // 摘要
      if (item.operation.summary) {
        parts.push(`\n摘要: ${item.operation.summary}`);
      }

      // URL 参数
      const parameters = item.operation.parameters ?? [];
      if (parameters.length > 0) {
        parts.push('\nURL 参数:');
        parameters.forEach((param) => {
          const paramParts = [];
          paramParts.push(`  参数名: ${param.name}`);
          paramParts.push(`  位置: ${param.in}`);
          if (param.schema?.type) paramParts.push(`  类型: ${param.schema.type}`);
          if (param.required !== undefined) paramParts.push(`  必填: ${param.required ? 'true' : 'false'}`);
          if (param.description) paramParts.push(`  描述: ${param.description}`);
          parts.push(paramParts.join('\n'));
          parts.push(''); // 空行分隔
        });
      }

      // 请求体示例
      if (requestExample) {
        parts.push('请求示例:');
        parts.push(formatJSON(requestExample));
        parts.push('');
      }

      // 响应示例
      if (responseExample?.example) {
        parts.push(`响应示例 (${responseExample.code}):`);
        parts.push(formatJSON(responseExample.example));
      }

      copyToClipboard(parts.join('\n'), 'all');
    };

    return (
      <div className="rounded border border-gray-200 transition-shadow duration-100">
        <div
          className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 p-3 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-1 font-mono text-xs font-semibold uppercase text-white duration-200 
              ${item.method === 'get' ? 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700' :
                  item.method === 'post' ? 'bg-green-500 hover:bg-green-600 active:bg-green-700' :
                    item.method === 'put' ? 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700' :
                      item.method === 'delete' ? 'bg-red-500 hover:bg-red-600 active:bg-red-700' :
                        'bg-gray-500 hover:bg-gray-600 active:bg-gray-700'}`}
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(item.method.toUpperCase(), 'url');
              }}
              title="点击复制请求方法"
            >
              {item.method}
            </span>
            <span
              className="font-mono text-sm hover:underline active:text-blue-700 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(item.path, 'url');
              }}
              title="点击复制路径"
            >
              {item.path}
            </span>
            {item.operation.summary && (
              <span
                className="text-sm text-gray-600 hover:underline active:text-blue-700 cursor-pointer truncate ml-4"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(item.operation.summary ?? "", 'summary');
                }}
                title={`${item.operation.summary}\n点击复制摘要`}
              >
                {item.operation.summary}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">

              <button
                className="text-gray-500 hover:text-gray-700 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  copyAllData();
                }}
                title="复制完整内容"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="p-3">
            <div className="space-y-4">
              {/* 描述信息 */}
              {item.operation.description && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">接口描述</h4>
                  <p
                    className="text-sm text-gray-600 hover:underline active:text-blue-700 cursor-pointer"
                    onClick={() => copyToClipboard(item.operation.description ?? "")}
                    title="点击复制描述"
                  >
                    {item.operation.description}
                  </p>
                </div>
              )}

              {/* 参数列表 */}
              {item?.operation?.parameters?.length && item?.operation?.parameters?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-gray-700">URL 参数</h4>
                    <button
                      onClick={() => {
                        const allParams = (item?.operation?.parameters as Parameter[])?.map(param => ({
                          name: param.name,
                          in: param.in,
                          type: param.schema?.type,
                          required: param.required,
                          description: param.description
                        }));
                        const text = allParams.map(param => {
                          const parts = [];
                          if (param.name) parts.push(`参数名: ${param.name}`);
                          if (param.in) parts.push(`位置: ${param.in}`);
                          if (param.type) parts.push(`类型: ${param.type}`);
                          if (param.required !== undefined) parts.push(`必填: ${param.required ? 'true' : 'false'}`);
                          if (param.description) parts.push(`描述: ${param.description}`);
                          return parts.join('\n');
                        }).join('\n\n');
                        copyToClipboard(text, 'params-all');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      复制全部参数
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border-b px-4 py-2 text-left">参数名</th>
                          <th className="border-b px-4 py-2 text-left">位置</th>
                          <th className="border-b px-4 py-2 text-left">类型</th>
                          <th className="border-b px-4 py-2 text-left">必填</th>
                          <th className="border-b px-4 py-2 text-left">描述</th>
                          <th className="border-b px-4 py-2 text-left">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(item?.operation?.parameters as Parameter[])?.map((param, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border-b px-4 py-2 font-mono cursor-pointer hover:text-blue-600 hover:underline"
                              onClick={() => copyToClipboard(param, 'param-row')}
                            >
                              {param.name}
                            </td>
                            <td className="border-b px-4 py-2 cursor-pointer hover:text-blue-600 hover:underline"
                              onClick={() => copyToClipboard(param, 'param-row')}
                            >
                              {param.in}
                            </td>
                            <td className="border-b px-4 py-2 font-mono cursor-pointer hover:text-blue-600 hover:underline"
                              onClick={() => copyToClipboard(param, 'param-row')}
                            >
                              {param.schema?.type ?? '未知'}
                            </td>
                            <td className="border-b px-4 py-2 cursor-pointer hover:text-blue-600 hover:underline"
                              onClick={() => copyToClipboard(param, 'param-row')}
                            >
                              {param.required ? '是' : '否'}
                            </td>
                            <td className="border-b px-4 py-2 cursor-pointer hover:text-blue-600 hover:underline"
                              onClick={() => copyToClipboard(param, 'param-row')}
                            >
                              {param.description ?? '-'}
                            </td>
                            <td className="border-b px-4 py-2">
                              <button
                                onClick={() => copyToClipboard(param, 'param-row')}
                                className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer text-sm"
                                title="复制整行"
                              >
                                复制行
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>)}

              {/* 请求体示例 */}
              {['post', 'put'].includes(item.method.toLowerCase()) && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">请求示例</h4>
                  <div className="relative">
                    <div className="absolute right-2 top-2">
                      <button
                        onClick={() => copyToClipboard(formatJSON(requestExample), 'request')}
                        className="text-gray-500 hover:text-gray-700 cursor-pointer"
                        title="复制示例"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <pre
                      className="bg-gray-50 p-3 rounded font-mono text-sm overflow-x-auto"
                      dangerouslySetInnerHTML={{
                        __html: formatJSON(requestExample)
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 响应示例 */}
              {responseExample?.example && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">
                    响应示例
                    <span className="ml-2 text-sm text-gray-500">
                      ({responseExample.code})
                    </span>
                  </h4>
                  <div className="relative">
                    <div className="absolute right-2 top-2">
                      <button
                        onClick={() => copyToClipboard(formatJSON(responseExample.example), 'response')}
                        className="text-gray-500 hover:text-gray-700 cursor-pointer"
                        title="复制示例"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <pre
                      className="bg-gray-50 p-3 rounded font-mono text-sm overflow-x-auto"
                      dangerouslySetInnerHTML={{
                        __html: formatJSON(responseExample.example)
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 标签分组组件 - 提取为单独组件以优化渲染
  const TagGroup = ({ tag, operations }: { tag: string; operations: { path: string; method: string; operation: OperationObject }[] }) => {
    const isCollapsed = collapsedTags[tag];

    return (
      <div
        className="mb-8 bg-white rounded-lg shadow-sm p-4 border-blue-500"
        ref={(el) => { tagRefs.current[tag] = el; }}
        id={`tag-${tag}`}
      >
        <div
          className="flex items-center mb-4 border-b border-gray-200 pb-2  group"
          onClick={() => toggleTagCollapse(tag)}
        >
          <div className='flex items-center cursor-pointer  group-hover:text-blue-500 transition-colors'>
            {isCollapsed ?
              <ChevronRight className="mr-2 cursor-pointer " size={20} /> :
              <ChevronDown className="mr-2 cursor-pointer " size={20} />
            }
            <h3 className="text-xl font-semibold group-hover:text-blue-500 cursor-pointer">{tag}</h3>
            <span className="ml-2 text-sm ">({operations.length})</span>
          </div>
        </div>

        {!isCollapsed && (
          <div className="space-y-4">
            {operations.map((item, index) => (
              <PathItem key={index} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // 导航栏组件
  const NavigationBar = () => {
    const tags = Object.keys(pathsByTag);

    if (tags.length === 0) return null;

    return (
      <div className={`fixed right-0 top-0 h-full z-10 transition-all duration-300 ease-in-out
        ${isNavVisible ? 'w-[280px]' : 'w-[40px]'}`}
      >
        <div className="h-full flex">
          {/* 切换按钮 */}
          <button
            onClick={() => setIsNavVisible(!isNavVisible)}
            className={`flex items-center justify-center h-full w-[40px] bg-gray-100 hover:bg-gray-200 
              transition-colors duration-200 border-l border-gray-200
              ${isNavVisible ? 'shadow-sm' : 'shadow-lg'}`}
            title={isNavVisible ? "收起导航" : "展开导航"}
          >
            <Bookmark size={20} className={`transform transition-transform duration-300 
              ${isNavVisible ? 'rotate-0 text-gray-600' : '-rotate-180 text-gray-400'}`}
            />
          </button>

          {/* 导航内容 */}
          <div className={`h-full bg-white/95 backdrop-blur-sm border-l border-gray-200 
            overflow-hidden transition-all duration-300 shadow-xl
            ${isNavVisible ? 'w-[240px] opacity-100' : 'w-0 opacity-0'}`}
          >
            <div className="h-full flex flex-col">
              {/* 导航头部 */}
              <div className="p-4 border-b border-gray-200 bg-white/50">
                <h3 className="text-lg font-semibold text-gray-700">API 导航</h3>
                <p className="text-sm text-gray-500 mt-1">共 {tags.length} 个分类</p>
              </div>

              {/* 导航列表 */}
              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">
                  {tags.map(tag => {
                    const operations = pathsByTag[tag] ?? [];
                    const isActive = tagRefs.current[tag] === document.activeElement;

                    return (
                      <div
                        key={tag}
                        className={`group rounded-lg transition-all duration-200
                          ${isActive ? 'bg-blue-50 shadow-sm' : 'hover:bg-gray-50'}`}
                      >
                        <button
                          onClick={() => scrollToTag(tag)}
                          className="w-full text-left p-3 flex items-center gap-2 group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700 truncate group-hover:text-blue-600">
                                {tag}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600">
                                {operations.length}
                              </span>
                            </div>

                            {/* 预览第一个接口 */}
                            {operations[0] && (
                              <p className="mt-1 text-xs text-gray-400 truncate group-hover:text-gray-600">
                                {operations[0].path}
                              </p>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 导航底部 */}
              <div className="p-3 border-t border-gray-200 bg-white/50">
                <p className="text-xs text-center text-gray-400">
                  点击标签快速导航到对应接口
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Minimap组件
  const MinimapButton = () => (
    <div className="fixed left-4 bottom-4 z-20">
      <button
        onClick={toggleMinimap}
        className={`flex items-center justify-center h-10 w-10 rounded-full shadow-lg transition-all duration-300 
          ${isMinimapVisible ? 'bg-blue-500 text-white rotate-180' : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'}`}
        title={isMinimapVisible ? "隐藏小地图" : "显示小地图"}
      >
        <Map size={18} className="transition-transform duration-300" />
      </button>
    </div>
  );

  const Minimap = () => {
    if (!isMinimapVisible || !apiDoc) return null;

    return (
      <div
        className={`fixed right-4 bottom-4 z-20 backdrop-blur-sm bg-white/40 hover:bg-white/90 
          rounded-lg shadow-lg p-4 w-[220px] max-h-[400px] overflow-hidden transition-all duration-300
          hover:shadow-xl transform hover:scale-[1.02]`}
      >
        <div className="relative">
          <div className="absolute top-0 right-0 left-0 h-6 bg-gradient-to-b from-white/80 to-transparent z-10" />
          <div className="absolute bottom-0 right-0 left-0 h-6 bg-gradient-to-t from-white/80 to-transparent z-10" />

          <div className="overflow-y-auto max-h-[380px] pr-2 minimap-scroll">
            <h4 className="text-xs font-bold mb-3 sticky top-0 bg-white/80 backdrop-blur-sm z-10 pb-2 border-b flex items-center gap-2">
              <Map size={12} />
              API 结构概览
            </h4>
            <ul className="text-xs space-y-3">
              {Object.entries(pathsByTag).map(([tag, operations]) => (
                <li key={tag} className="relative group">
                  <button
                    className={`text-left w-full py-1 px-2 rounded-md transition-all duration-200
                      ${collapsedTags[tag] ? 'bg-gray-50/50' : 'bg-blue-50/50 shadow-sm'}
                      hover:bg-blue-100/50`}
                    onClick={() => scrollToTag(tag)}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`truncate ${collapsedTags[tag] ? '' : 'font-medium text-blue-600'}`}>
                        {tag}
                      </span>
                      <span className="ml-1 text-[10px] text-gray-500">
                        {operations.length}
                      </span>
                    </div>
                  </button>

                  {!collapsedTags[tag] && (
                    <ul className="mt-1 space-y-1 pl-3 border-l border-gray-200">
                      {operations.slice(0, 3).map((op, idx) => (
                        <li key={idx} className="group/item">
                          <div className="flex items-center gap-1 opacity-70 group-hover/item:opacity-100 transition-opacity">
                            <span className={`inline-block w-8 text-center rounded-sm text-[8px] font-medium
                              ${op.method === 'get' ? 'bg-blue-100 text-blue-600' :
                                op.method === 'post' ? 'bg-green-100 text-green-600' :
                                  op.method === 'put' ? 'bg-yellow-100 text-yellow-600' :
                                    op.method === 'delete' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}
                            >
                              {op.method.toUpperCase()}
                            </span>
                            <span className="truncate text-[10px] text-gray-600">
                              {op.path.split('/').pop()}
                            </span>
                          </div>
                        </li>
                      ))}
                      {operations.length > 3 && (
                        <li className="text-[10px] text-gray-400 pl-2">
                          +{operations.length - 3} 个接口...
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // 设置菜单组件
  const SettingsMenu = () => {
    if (!isSettingsOpen) return null;

    return (
      <div className="fixed right-4 top-16 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="text-lg font-semibold">设置</h3>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">复制时添加描述</label>
            <button
              onClick={() => setCopyWithDesc(!copyWithDesc)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${copyWithDesc ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${copyWithDesc ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">OpenAPI 查看器</h1>
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="设置"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>
      <SettingsMenu />
      <div className="relative flex flex-1 overflow-hidden" ref={containerRef}>
        {/* 左侧输入区域 */}
        <div
          className={`overflow-hidden   ease-in-out ${isLeftPanelCollapsed ? 'w-0' : ''}`}
          style={{ width: isLeftPanelCollapsed ? 0 : `${leftPanelWidth}%` }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="flex h-full flex-col p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">输入 OpenAPI JSON</h2>
              <div className="flex space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".json"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600"
                >
                  上传文件
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded bg-red-100 p-2 text-red-700">
                {error}
              </div>
            )}

            <div className="flex-grow relative">
              <MonacoEditor
                language="json"
                theme="vs-light"
                value={inputValue}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  wordWrap: "on",
                  automaticLayout: true,
                }}
                className="h-full w-full border border-gray-300 rounded"
              />
            </div>
          </div>
        </div>

        {/* 可拖动分隔线 + 折叠/展开按钮 */}
        <div
          className={`flex items-center z-10 ${isLeftPanelCollapsed ? 'border-l' : ''}`}
        >
          <button
            onClick={toggleLeftPanel}
            className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
            title={isLeftPanelCollapsed ? "展开输入面板" : "折叠输入面板"}
          >
            {isLeftPanelCollapsed ? (
              <ArrowLeftRight size={16} />
            ) : (
              <Menu size={16} />
            )}
          </button>

          {!isLeftPanelCollapsed && (
            <div
              className="z-10 cursor-ew-resize w-2 bg-gray-300 hover:bg-blue-400 active:bg-blue-600 transition-colors h-full ml-3"
              onMouseDown={handleDragStart}
            />
          )}
        </div>

        {/* 右侧展示区域 */}
        <div
          className="overflow-auto p-4   ease-in-out bg-gray-50"
          style={{ width: isLeftPanelCollapsed ? '100%' : `${100 - leftPanelWidth}%` }}
        >
          {apiDoc ? (
            <div>
              <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
                <h2 className="text-2xl font-bold">{apiDoc.info.title} <span className="ml-2 text-sm text-gray-500">v{apiDoc.info.version}</span></h2>
                {apiDoc.info.description && (
                  <p className="mt-2 text-gray-600">{apiDoc.info.description}</p>
                )}
              </div>

              {Object.keys(pathsByTag).length > 0 ? (
                <>
                  <NavigationBar />
                  <MinimapButton />
                  <Minimap />

                  {Object.entries(pathsByTag).map(([tag, operations]) => (
                    <TagGroup key={tag} tag={tag} operations={operations} />
                  ))}
                </>
              ) : (
                <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
                  未发现任何 API 端点
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              <p>在左侧输入或上传 OpenAPI JSON 文件以查看解析结果</p>
            </div>
          )}
        </div>
      </div>

      {/* 复制提示 */}
      {copiedText && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg opacity-80 transition-opacity ">
          已复制到剪贴板
        </div>
      )}
    </div>
  );
}
