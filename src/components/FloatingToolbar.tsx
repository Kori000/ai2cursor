import { Check, Copy, CopyCheck, FileJson, Info, Layers, Settings2, SmilePlus, Users, X } from "lucide-react";
import { Fragment } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface OpenAPIOperation {
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: string;
    type?: string;
    schema?: { type?: string };
    required?: boolean;
    description?: string;
  }>;
  requestBody?: {
    content: Record<string, {
      schema?: any;
      example?: any;
      examples?: Record<string, {
        value?: any;
        summary?: string;
      }>;
    }>;
    required?: boolean;
    description?: string;
  };
  responses: Record<string, {
    description?: string;
    schema?: any;
    headers?: Record<string, unknown>;
    content?: Record<string, {
      schema?: any;
      example?: any;
      examples?: Record<string, {
        value?: any;
        summary?: string;
      }>;
    }>;
  }>;
}

interface OpenAPIDocument {
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    schemas: Record<string, any>;
  };
  definitions?: Record<string, any>;
}

export interface CopyOptions {
  url: boolean;
  summary: boolean;
  description: boolean;
  parameters: boolean;
  requestExample: boolean;
  responseExample: boolean;
}

interface FloatingToolbarProps {
  copyWithDesc: boolean;
  setCopyWithDesc: (value: boolean) => void;
  isSelectionMode: boolean;
  setIsSelectionMode: (value: boolean) => void;
  isMinimapVisible: boolean;
  setIsMinimapVisible: (value: boolean) => void;
  isLeftPanelCollapsed: boolean;
  setIsLeftPanelCollapsed: (value: boolean) => void;
  isNavVisible: boolean;
  setIsNavVisible: (value: boolean) => void;
  selectedApis: Set<string>;
  setSelectedApis: (value: Set<string>) => void;
  apiDoc: OpenAPIDocument | null;
  hasContent: boolean;
  copyOptions: CopyOptions;
  setCopyOptions: (value: CopyOptions) => void;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

const ToolbarButton = ({ icon, tooltip, isActive, onClick, className }: ToolbarButtonProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`group relative p-3 ${isActive ? 'text-blue-600 bg-blue-50' : 'hover:bg-gray-100'
            } rounded-lg transition-all duration-300 ${className}`}
        >
          <div className="flex h-4 w-8 items-center justify-center">
            {icon}
          </div>
          {isActive && (
            <div className="absolute inset-0 rounded-lg  ring-2 ring-blue-600/30" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const CopyOptionsPopover = ({ copyOptions, setCopyOptions, hasContent }: { copyOptions: CopyOptions; setCopyOptions: (value: CopyOptions) => void; hasContent: boolean }) => {
  const options = [
    { id: 'url', label: 'URL' },
    { id: 'summary', label: '摘要' },
    { id: 'description', label: '描述' },
    { id: 'parameters', label: 'URL 参数' },
    { id: 'requestExample', label: '请求示例' },
    { id: 'responseExample', label: '响应示例' },
  ] as const;

  return (
    <div className="relative">
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "group relative p-3 hover:bg-gray-100 rounded-lg transition-all duration-300",
                  !hasContent && "opacity-50 pointer-events-none"
                )}
              >
                <div className="flex h-4 w-8 items-center justify-center">
                  <Settings2 className="group-hover:scale-110 transition-transform duration-300" size={20} />
                </div>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>批量复制/复制完整内容的选项</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent align="center" sideOffset={14} className="w-[200px] p-0 bg-[#1C1C1C] rounded-lg shadow-xl">
          <div className="p-2 flex flex-col gap-1">
            {options.map((option) => (
              <button
                key={option.id}
                className={cn(
                  "w-full flex items-center justify-start text-white px-3 py-1.5 text-sm font-medium transition-colors rounded-md hover:bg-[#0F8EFF]",
                  copyOptions[option.id] ? "" : ""
                )}
                onClick={() => setCopyOptions({ ...copyOptions, [option.id]: !copyOptions[option.id] })}
              >
                <div className="flex items-center justify-center w-4 h-4 mr-2">
                  {copyOptions[option.id] && <Check size={16} />}
                </div>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export function FloatingToolbar({
  copyWithDesc,
  setCopyWithDesc,
  isSelectionMode,
  setIsSelectionMode,
  isLeftPanelCollapsed,
  setIsLeftPanelCollapsed,
  isNavVisible,
  setIsNavVisible,
  selectedApis,
  setSelectedApis,
  apiDoc,
  hasContent,
  copyOptions,
  setCopyOptions
}: FloatingToolbarProps) {
  const copySelectedApisData = () => {
    if (!apiDoc) return;

    const selectedApiData: string[] = [];

    selectedApis.forEach(apiKey => {
      const [method, path] = apiKey.split('::');
      Object.entries(apiDoc.paths).forEach(([pathPattern, methods]) => {
        if (pathPattern === path && method && methods && method in methods) {
          const operation = methods[method];
          if (!operation) return;

          const parts: string[] = [];

          // URL
          if (copyOptions.url) {
            parts.push(`URL: ${method.toUpperCase()} ${path}`);
          }

          // 摘要
          if (copyOptions.summary && operation.summary) {
            parts.push(`\n摘要: ${operation.summary}`);
          }

          // 描述
          if (copyOptions.description && operation.description) {
            parts.push(`\n描述: ${operation.description}`);
          }

          // URL 参数
          if (copyOptions.parameters) {
            const parameters = operation.parameters ?? [];
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
          }

          // 请求示例
          if (copyOptions.requestExample && ['post', 'put'].includes(method.toLowerCase())) {
            const requestBody = operation.requestBody;
            if (requestBody?.content) {
              const firstContentType = Object.entries(requestBody.content)[0];
              if (firstContentType) {
                const [contentType, content] = firstContentType;
                const example = content.example ?? generateExampleFromSchema(content.schema);
                if (example) {
                  parts.push('\n请求示例:');
                  parts.push(JSON.stringify(example, null, 2));
                }
              }
            }
          }

          // 响应示例
          if (copyOptions.responseExample) {
            const successResponse = Object.entries(operation.responses)
              .find(([code]) => code.startsWith('2'));

            if (successResponse) {
              const [code, response] = successResponse;
              if (response.content) {
                const firstContentType = Object.entries(response.content)[0];
                if (firstContentType) {
                  const [contentType, content] = firstContentType;
                  let example = null;

                  // 首先检查 examples
                  if (content.examples) {
                    const successExample = Object.entries(content.examples).find(([key, example]) => {
                      if (typeof example === 'object' && example !== null && 'value' in example) {
                        const value = example.value;
                        return value?.code === 200 || key.includes('success');
                      }
                      return false;
                    });

                    if (successExample) {
                      example = successExample[1].value;
                    }
                  }

                  // 然后检查直接的 example
                  if (!example && content.example) {
                    example = content.example;
                  }

                  // 最后尝试从 schema 生成示例
                  if (!example && content.schema) {
                    example = generateExampleFromSchema(content.schema);
                  }

                  if (example) {
                    parts.push(`\n响应示例 (${code}):`);
                    parts.push(JSON.stringify(example, null, 2));
                  }
                }
              }
            }
          }

          selectedApiData.push(parts.join('\n'));
          selectedApiData.push('\n---\n'); // API 分隔符
        }
      });
    });

    if (selectedApiData.length > 0) {
      navigator.clipboard.writeText(selectedApiData.join('\n')).then(
        () => {
          toast.success(`已复制 ${selectedApis.size} 个 API 到剪贴板`);
        },
        (err) => {
          console.error('无法复制文本: ', err);
          toast.error('复制失败');
        }
      );
    }
  };

  const tools = [
    {
      icon: <FileJson className="group-hover:scale-110 transition-transform duration-300" size={20} />,
      tooltip: "显示编辑器",
      isActive: !isLeftPanelCollapsed,
      needContent: false,
      onClick: () => setIsLeftPanelCollapsed(!isLeftPanelCollapsed),
    },
    {
      icon: <Layers className="group-hover:scale-110 transition-transform duration-300" size={20} />,
      tooltip: "显示导航栏",
      isActive: isNavVisible,
      needContent: true,
      onClick: () => setIsNavVisible(!isNavVisible),
    },
    {
      component: <CopyOptionsPopover copyOptions={copyOptions} setCopyOptions={setCopyOptions} hasContent={hasContent} />,
      tooltip: "复制选项",
      isActive: false,
      needContent: true,
    },
    {
      icon: <SmilePlus className="group-hover:scale-110 transition-transform duration-300" size={20} />,
      tooltip: "单项复制添加描述",
      isActive: copyWithDesc,
      needContent: true,
      onClick: () => setCopyWithDesc(!copyWithDesc),
    },
    {
      icon: <CopyCheck className="group-hover:scale-110 transition-transform duration-300" size={20} />,
      tooltip: "批量选择",
      isActive: isSelectionMode,
      needContent: true,
      onClick: () => {
        setIsSelectionMode(!isSelectionMode);
        if (isSelectionMode) {
          setSelectedApis(new Set());
        }
      },
    },

  ];

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

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center gap-3">
      {/* 选择模式工具栏 */}
      {isSelectionMode && (
        <div className="flex items-center gap-2 p-2 bg-blue-50/95 backdrop-blur-sm border border-blue-200/50 rounded-xl shadow-lg">
          <div className="flex items-center gap-2 px-3">
            <span className="text-sm font-medium text-blue-700">
              已选择 {selectedApis.size} 个接口
            </span>
          </div>
          {selectedApis.size > 0 && (
            <>
              <div className="h-4 w-px bg-blue-200/90" />
              <button
                onClick={copySelectedApisData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-lg transition-colors duration-200"
              >
                <Copy size={16} />
                复制已选
              </button>
              <button
                onClick={() => setSelectedApis(new Set())}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-lg transition-colors duration-200"
              >
                <X size={16} />
                取消全选
              </button>
            </>
          )}
          <div className="h-4 w-px bg-blue-200/90" />
          <button
            onClick={() => {
              setIsSelectionMode(false);
              setSelectedApis(new Set());
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
          >
            退出选择
          </button>
        </div>
      )}

      {/* 主工具栏 */}
      <TooltipProvider>
        <div className="p-2 transition-all duration-500 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-lg">
          <div className="flex items-center gap-2 transition-all duration-500">
            {tools.map((tool, index) => {
              if (tool.component) {
                return (
                  <Fragment key={index}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {tool.component}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{tool.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                    {index < tools.length - 1 && (
                      <div className="w-px h-4 mx-1 bg-gray-200/90" />
                    )}
                  </Fragment>
                );
              }

              return (
                <Fragment key={index}>
                  <ToolbarButton
                    className={cn((tool.needContent && !hasContent) && 'opacity-50 pointer-events-none')}
                    key={index}
                    {...tool}
                  />
                  {index < tools.length - 1 && (
                    <div className="w-px h-4 mx-1 bg-gray-200/90" />
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
} 
