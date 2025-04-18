"use client";

import { ArrowLeftRight, Bookmark, ChevronDown, ChevronRight, Copy, Menu } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CodeBlock } from "~/components/CodeBlock";
import { FloatingToolbar } from "~/components/FloatingToolbar";
import { GhostAnimation } from "~/components/GhostAnimation";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { FileActions } from "./_components/file-actions";
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
  additionalProperties: z.unknown().optional(),
  xml: z.unknown().optional(),
  description: z.string().optional(),
  default: z.unknown().optional(),
  maximum: z.number().optional(),
  minimum: z.number().optional(),
  collectionFormat: z.string().optional(),
  title: z.string().optional(),
  allOf: z.array(z.lazy(() => SchemaObject.or(z.object({ $ref: z.string() })))).optional(),
});


// 定义操作对象的类型
const OperationObjectSchema = z.object({
  summary: z.string().optional(),
  description: z.string().optional(),
  operationId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  consumes: z.array(z.string()).optional(),
  produces: z.array(z.string()).optional(),
  parameters: z.array(z.object({
    name: z.string(),
    in: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    type: z.string().optional(),
    format: z.string().optional(),
    schema: SchemaObject.optional(),
    items: z.unknown().optional(),
    collectionFormat: z.string().optional(),
    maximum: z.number().optional(),
    minimum: z.number().optional(),
    example: z.unknown().optional(),
  })).optional(),
  requestBody: z.object({
    content: z.record(z.object({
      schema: SchemaObject.or(z.object({ $ref: z.string() })),
      example: z.unknown().optional(),
      examples: z.record(z.object({
        summary: z.string().optional(),
        value: z.unknown(),
      })).optional(),
    })),
    required: z.boolean().optional(),
    description: z.string().optional(),
  }).optional(),
  responses: z.record(z.object({
    description: z.string().optional(),
    schema: SchemaObject.optional(),
    headers: z.record(z.unknown()).optional(),
    content: z.record(z.object({
      schema: SchemaObject.or(z.object({ $ref: z.string() })),
      example: z.unknown().optional(),
      examples: z.record(z.object({
        summary: z.string().optional(),
        value: z.unknown(),
      })).optional(),
    })).optional(),
  })),
  security: z.array(z.record(z.array(z.string()))).optional(),
  deprecated: z.boolean().optional(),
});

type OperationObject = z.infer<typeof OperationObjectSchema>;
type Parameter = {
  name: string;
  in: string;
  description?: string;
  required?: boolean;
  schema?: { type?: string };
  type?: string;
  format?: string;
  items?: unknown;
  collectionFormat?: string;
  maximum?: number;
  minimum?: number;
  example?: unknown;
};


// 基本的 OpenAPI Schema 验证器
const OpenAPISchema = z.object({
  swagger: z.string().optional(),
  openapi: z.string().optional(),
  info: z.object({
    title: z.string(),
    version: z.string(),
    description: z.string().optional(),
    termsOfService: z.string().optional(),
    contact: z.object({
      email: z.string().optional(),
    }).optional(),
    license: z.object({
      name: z.string().optional(),
      url: z.string().optional(),
    }).optional(),
  }),
  host: z.string().optional(),
  basePath: z.string().optional(),
  schemes: z.array(z.string()).optional(),
  consumes: z.array(z.string()).optional(),
  produces: z.array(z.string()).optional(),
  tags: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      externalDocs: z.object({
        description: z.string().optional(),
        url: z.string().optional(),
      }).optional(),
    })
  ).optional(),
  paths: z.record(z.record(OperationObjectSchema)),
  components: z.object({
    schemas: z.record(SchemaObject),
    securitySchemes: z.record(z.unknown()).optional(),
  }).optional(),
  definitions: z.record(SchemaObject).optional(),
  securityDefinitions: z.record(z.unknown()).optional(),
  externalDocs: z.object({
    description: z.string().optional(),
    url: z.string().optional(),
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
  const tagRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [isMinimapVisible, setIsMinimapVisible] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [copyWithDesc, setCopyWithDesc] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedApis, setSelectedApis] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (!Boolean(inputValue.trim())) {
      setIsSelectionMode(false);
      setCopyWithDesc(false);
      setError(null);
      setApiDoc(null);
    }
  }, [inputValue]);

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


  // 获取请求方法对应的颜色
  const getMethodColors = (method: string) => {
    switch (method.toLowerCase()) {
      case 'get':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          hover: 'hover:border-blue-300 hover:bg-blue-100'
        };
      case 'post':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          hover: 'hover:border-green-300 hover:bg-green-100'
        };
      case 'put':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          hover: 'hover:border-yellow-300 hover:bg-yellow-100'
        };
      case 'delete':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          hover: 'hover:border-red-300 hover:bg-red-100'
        };
      case 'patch':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          hover: 'hover:border-purple-300 hover:bg-purple-100'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          hover: 'hover:border-gray-300 hover:bg-gray-100'
        };
    }
  };

  // 切换 API 选择状态
  const toggleApiSelection = useCallback((method: string, path: string) => {
    const apiKey = `${method}::${path}`;
    setSelectedApis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(apiKey)) {
        newSet.delete(apiKey);
      } else {
        newSet.add(apiKey);
      }
      return newSet;
    });
  }, []);

  // 路径项组件 - 提取为单独组件以优化渲染
  const PathItem = ({ item }: { item: { path: string; method: string; operation: OperationObject } }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const methodColors = getMethodColors(item.method);
    const apiKey = `${item.method}::${item.path}`;
    const isSelected = selectedApis.has(apiKey);

    // 获取请求体示例
    const getRequestExample = () => {
      if (!item.operation.requestBody?.content) return null;

      const firstContentType = Object.entries(item.operation.requestBody.content)[0];
      if (!firstContentType) return null;

      const [contentType, content] = firstContentType;

      return {
        contentType,
        example: content.example ?? null,
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

      // 首先检查 examples
      if (content.examples) {
        // 找到第一个成功的示例（通常是 code 为 200 的示例）
        const successExample = Object.entries(content.examples).find(([key, example]) => {
          if (typeof example === 'object' && example !== null && 'value' in example) {
            const value = example.value as any;
            return value?.code === 200 || key.includes('success');
          }
          return false;
        });

        if (successExample) {
          const [key, example] = successExample;
          return {
            code,
            contentType,
            example: example.value,
            summary: example.summary
          };
        }
      }

      // 然后检查直接的 example
      if (content.example) {
        return {
          code,
          contentType,
          example: content.example
        };
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
      if (item.operation.requestBody?.content?.['application/json']?.schema) {
        const schema = item.operation.requestBody.content['application/json'].schema;
        return generateExampleFromSchema(schema);
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

      // 处理 allOf
      if (schema.allOf) {
        const result: Record<string, any> = {};
        for (const subSchema of schema.allOf) {
          const subExample = generateExampleFromSchema(subSchema);
          if (typeof subExample === 'object' && subExample !== null) {
            Object.assign(result, subExample);
          }
        }
        // 如果 schema 本身有额外的属性，也合并进去
        if (schema.properties) {
          const propsExample = generateExampleFromSchema({
            type: 'object',
            properties: schema.properties,
            required: schema.required
          });
          Object.assign(result, propsExample);
        }
        return result;
      }

      // 如果是引用类型
      if (schema.$ref) {
        const schemaName = schema.$ref.replace('#/components/schemas/', '');
        const refSchema = apiDoc?.components?.schemas?.[schemaName] ?? apiDoc?.definitions?.[schemaName];
        if (refSchema) {
          const refExample = generateExampleFromSchema(refSchema);
          // 如果引用的 schema 有 title 或 description，可以用作示例值的注释
          if (schema.title ?? schema.description) {
            return {
              ...refExample,
              __comment: schema.title ?? schema.description
            };
          }
          return refExample;
        }
      }

      // 处理对象类型
      if (schema.type === 'object' || schema.properties) {
        const result: Record<string, any> = {};
        const properties = schema.properties as Record<string, any>;
        if (properties) {
          for (const [key, prop] of Object.entries(properties)) {
            const value = generateExampleFromSchema(prop);
            if (value !== undefined) {
              result[key] = value;
            }
          }
        }
        // 处理 additionalProperties
        if (schema.additionalProperties) {
          // 如果 additionalProperties 是一个对象，生成一个示例属性
          if (typeof schema.additionalProperties === 'object') {
            const examplePropValue = generateExampleFromSchema(schema.additionalProperties);
            // 添加两个示例属性
            result.additionalProp1 = examplePropValue;
            result.additionalProp2 = examplePropValue;
            result.additionalProp3 = examplePropValue;
          }
        }
        // 如果有 title 或 description，添加为注释
        if (schema.title ?? schema.description) {
          result.__comment = schema.title ?? schema.description;
        }
        return result;
      }

      // 处理数组类型
      if (schema.type === 'array' && schema.items) {
        const itemExample = generateExampleFromSchema(schema.items);
        return itemExample !== undefined ? [itemExample] : [];
      }

      // 基础类型的默认值
      switch (schema.type) {
        case 'string':
          if (schema.format === 'date') return "2025-04-18";
          if (schema.format === 'date-time') return "2025-04-18T00:00:00";
          if (schema.enum?.length > 0) return schema.enum[0];
          if (schema.title) return `示例${schema.title}`;
          if (schema.description) return `示例${schema.description}`;
          return "string";
        case 'number':
        case 'integer':
          if (schema.default !== undefined) return schema.default;
          if (schema.minimum !== undefined) return schema.minimum;
          if (schema.maximum !== undefined) return schema.maximum;
          return 0;
        case 'boolean':
          if (schema.default !== undefined) return schema.default;
          return false;
        case 'null':
          return null;
        default:
          if (schema.default !== undefined) return schema.default;
          return undefined;
      }
    };

    // 格式化 JSON 显示
    const formatJSON = (obj: unknown): string => {
      try {
        // 移除 __comment 字段
        const cleanObj = JSON.parse(JSON.stringify(obj, (key, value) => {
          if (key === '__comment') return undefined;
          return value;
        }));
        // 添加语法高亮 - 使用深色主题配色
        return JSON.stringify(cleanObj, null, 2)
          .replace(/"([^"]+)":/g, '<span class="text-[#ffffff]">"$1"</span>:')  // 键名颜色 - 白色
          .replace(/: "([^"]+)"/g, ': <span class="text-[#a2fca2]">"$1"</span>')  // 字符串值颜色 - 浅绿色
          .replace(/: (true|false)/g, ': <span class="text-[#569cd6]">$1</span>')  // 布尔值颜色 - 蓝色
          .replace(/: (null)/g, ': <span class="text-[#569cd6]">$1</span>')  // null 值颜色 - 蓝色
          .replace(/: (\d+)/g, ': <span class="text-[#d36363]">$1</span>');  // 数字颜色 - 红色
      } catch (e) {
        return '无效的 JSON 数据';
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
        parameters.forEach((param: any) => {
          const paramParts = [];
          paramParts.push(`  参数名: ${param.name}`);
          paramParts.push(`  位置: ${param.in}`);
          if (param.type) paramParts.push(`  类型: ${param.type}`);
          if (!param.type && param.schema?.type) paramParts.push(`  类型: ${param.schema.type}`);
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
      <div className={`rounded border ${methodColors.border} ${methodColors.bg}`}>
        <div
          className="flex flex-col gap-2 border-b border-inherit p-3 cursor-pointer"
          onClick={(e) => {
            if (isSelectionMode) {
              toggleApiSelection(item.method, item.path);
            } else {
              setIsExpanded(!isExpanded);
            }
          }}
        >
          <div className="flex items-center gap-2">
            {isSelectionMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleApiSelection(item.method, item.path)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            )}
            <span
              className={`rounded px-2 py-1 font-mono text-sm font-semibold uppercase text-white duration-200 inline-block w-[70px] text-center
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
              className="font-mono text-[#3b4151] text-base hover:underline active:text-blue-700 cursor-pointer font-semibold "
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
                className="text-sm text-gray-600 hover:underline active:text-blue-700 cursor-pointer truncate ml-3"
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
              {Boolean(item?.operation?.parameters?.length) && (
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
                      className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      复制全部参数
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#2d2d2d]">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-[#ffffff] border-b border-gray-700">参数名</th>
                          <th className="px-4 py-2 text-left font-medium text-[#ffffff] border-b border-gray-700">位置</th>
                          <th className="px-4 py-2 text-left font-medium text-[#ffffff] border-b border-gray-700">类型</th>
                          <th className="px-4 py-2 text-left font-medium text-[#ffffff] border-b border-gray-700">必填</th>
                          <th className="px-4 py-2 text-left font-medium text-[#ffffff] border-b border-gray-700">描述</th>
                          <th className="px-4 py-2 text-left font-medium text-[#ffffff] border-b border-gray-700">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(item?.operation?.parameters as Parameter[])?.map((param, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252525]'}>
                            <td className="border-b border-gray-700 px-4 py-2 font-mono text-[#ffffff] cursor-pointer hover:text-[#a2fca2]"
                              onClick={() => copyToClipboard(param, 'param-row')}
                            >
                              {param.name}
                            </td>
                            <td className="border-b border-gray-700 px-4 py-2 text-[#ffffff] cursor-pointer hover:text-[#a2fca2]"
                              onClick={() => copyToClipboard(param, 'param-row')}
                            >
                              {param.in}
                            </td>
                            <td className="border-b border-gray-700 px-4 py-2 font-mono text-[#d36363] cursor-pointer hover:text-[#a2fca2]"
                              onClick={() => copyToClipboard(param, 'param-row')}
                            >
                              {param.schema?.type ?? '未知'}
                            </td>
                            <td className="border-b border-gray-700 px-4 py-2 text-[#569cd6] cursor-pointer hover:text-[#a2fca2]"
                              onClick={() => copyToClipboard(param, 'param-row')}
                            >
                              {param.required ? '是' : '否'}
                            </td>
                            <td className="border-b border-gray-700 px-4 py-2 text-[#ffffff] cursor-pointer hover:text-[#a2fca2]"
                              onClick={() => copyToClipboard(param, 'param-row')}
                            >
                              {param.description ?? '-'}
                            </td>
                            <td className="border-b border-gray-700 px-4 py-2">
                              <button
                                onClick={() => copyToClipboard(param, 'param-row')}
                                className="text-[#a2fca2] hover:text-[#7cdd7c] hover:underline cursor-pointer text-sm"
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
              {['post', 'put'].includes(item.method.toLowerCase()) && formatJSON(requestExample) != 'null' && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">请求示例</h4>
                  <div className="relative">
                    <div className="absolute right-2 top-2">
                      <button
                        onClick={() => copyToClipboard(formatJSON(requestExample), 'request')}
                        className="text-[#3b4151] hover:text-[#4990e2] cursor-pointer"
                        title="复制示例"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <CodeBlock
                      code={formatJSON(requestExample)}
                      rawCode={JSON.stringify(requestExample, null, 2)}
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
                        className="text-[#3b4151] hover:text-[#4990e2] cursor-pointer"
                        title="复制示例"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <CodeBlock
                      code={formatJSON(responseExample.example)}
                      rawCode={JSON.stringify(responseExample.example, null, 2)}
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
      <div className={`fixed right-0 top-[73px] bottom-0 transition-all duration-300 ease-in-out
        ${isNavVisible ? 'w-[280px]' : 'w-[40px]'}`}
      >
        <div className="h-full flex ">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsNavVisible(!isNavVisible)}
            className={`flex items-center justify-center h-full w-[40px] 
              transition-colors duration-200 border-l border-gray-200
              ${isNavVisible ? 'shadow-sm' : 'shadow-lg'}`}
            title={isNavVisible ? "收起导航" : "展开导航"}
          >
            <Bookmark size={20} className={`transform transition-transform duration-300 
              ${isNavVisible ? 'rotate-0 text-gray-600' : '-rotate-180 text-gray-400'}`}
            />
          </Button>

          <div className={`h-full relative  flex-1 bg-white/95 backdrop-blur-sm border-l border-gray-200 
            overflow-hidden transition-all duration-300 shadow-xl
            ${isNavVisible ? 'w-[240px] opacity-100' : 'w-0 opacity-0'}`}
          >
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-white/50">
                <h3 className="text-lg font-semibold text-gray-700">API 导航</h3>
                <p className="text-sm text-gray-500 mt-1">共 {tags.length} 个分类</p>
              </div>

              <div className="flex-1 overflow-y-scroll hide-scrollbar">
                <div className="p-2 space-y-1">
                  {tags.map(tag => {
                    const operations = pathsByTag[tag] ?? [];

                    return (
                      <div
                        key={tag}
                        className="group w-full rounded-lg transition-all duration-200 "
                      >
                        <Button
                          variant="ghost"
                          onClick={() => scrollToTag(tag)}
                          className="w-full justify-start p-3 h-auto hover:bg-gray-200"
                        >
                          <div className="w-full flex flex-col min-w-0">
                            <div className="flex items-center w-full gap-2">
                              <span className="font-medium truncate text-start min-w-0 flex-1 text-gray-700">
                                {tag}
                              </span>
                              <Badge variant="outline" className="shrink-0">
                                {operations.length}
                              </Badge>
                            </div>

                            {operations[0] && (
                              <p className="mt-1 text-xs text-start text-gray-400 truncate">
                                {operations[0].path}
                              </p>
                            )}
                          </div>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

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

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-gray-200 font-mono bg-white p-4 pb-3 shadow-sm z-20">
        <div className="flex justify-start items-center">
          <Image
            src="/logo.png"
            alt=""
            className="w-10 h-10"
            width={40}
            height={40}
          />
          <h1 className="text-lg font-bold ml-4">OpenAPI Copyer</h1>

        </div>
      </header>
      <div className="relative flex flex-1 overflow-hidden" ref={containerRef}>
        {/* 左侧输入区域 */}
        <div
          className={`overflow-hidden ease-in-out ${isLeftPanelCollapsed ? 'w-0' : ''}`}
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

                <FileActions
                  hasContent={Boolean(inputValue.trim())}
                  onUpload={() => fileInputRef.current?.click()}
                  onClear={() => {
                    setInputValue("");
                    setApiDoc(null);
                    setError(null)
                  }}
                  onExampleSelect={(content) => {
                    setInputValue(content);
                    parseOpenAPI(content);
                  }}
                />
              </div>
            </div>

            {error && (
              // 最多显示三行
              <div className="mb-4 rounded bg-red-100 p-2 text-red-700  ">
                <span className='line-clamp-3'>{error}</span>
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
          className={`overflow-auto p-4 pb-20 ease-in-out bg-gray-50 transition-all duration-300 pt-0 relative
            ${isNavVisible ? 'mr-[280px]' : 'mr-[40px]'}`}
          style={{ width: isLeftPanelCollapsed ? '100%' : `${100 - leftPanelWidth}%` }}
        >
          {apiDoc ? (
            <div className='pt-3 '>
              <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
                <h2 className="text-2xl font-bold">{apiDoc.info.title} <span className="ml-2 text-sm text-gray-500">v{apiDoc.info.version}</span></h2>
                {apiDoc.info.description && (
                  <p className="mt-2 text-gray-600">{apiDoc.info.description}</p>
                )}
              </div>

              {Object.keys(pathsByTag).length > 0 ? (
                <>
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
            <div className="flex h-full items-center justify-center text-gray-500 flex-col gap-8">
              <GhostAnimation className="w-[200px] h-[200px] scale-70 translate-y-8" color="rgba(9, 131, 246, 0.2)" />
              {/* <RippleAnimation className="w-[200px] h-[200px]" color="rgba(9, 131, 246, 0.2)" /> */}
              <p className='font-mono text-base'>在左侧输入或上传 OpenAPI JSON 文件以查看解析结果</p>
            </div>
          )}

          <FloatingToolbar
            hasContent={Boolean(inputValue.trim())}
            copyWithDesc={copyWithDesc}
            setCopyWithDesc={setCopyWithDesc}
            isSelectionMode={isSelectionMode}
            setIsSelectionMode={setIsSelectionMode}
            isMinimapVisible={isMinimapVisible}
            setIsMinimapVisible={setIsMinimapVisible}
            isLeftPanelCollapsed={isLeftPanelCollapsed}
            setIsLeftPanelCollapsed={setIsLeftPanelCollapsed}
            isNavVisible={isNavVisible}
            setIsNavVisible={setIsNavVisible}
            selectedApis={selectedApis}
            setSelectedApis={setSelectedApis}
            apiDoc={apiDoc}
          />
        </div>

        <NavigationBar />
      </div>
    </div>
  );
}
