import { Copy, FileJson, Layers, Users, X } from "lucide-react";
import { Fragment } from "react";
import { toast } from "sonner";
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
}

interface OpenAPIDocument {
  paths: Record<string, Record<string, OpenAPIOperation>>;
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
  hasContent
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
          parts.push(`URL: ${method.toUpperCase()} ${path}`);

          // 摘要
          if (operation.summary) {
            parts.push(`\n摘要: ${operation.summary}`);
          }

          // 描述
          if (operation.description) {
            parts.push(`\n描述: ${operation.description}`);
          }

          // URL 参数
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
      icon: <Copy className="group-hover:scale-110 transition-transform duration-300" size={20} />,
      tooltip: "复制添加描述",
      isActive: copyWithDesc,
      needContent: true,
      onClick: () => setCopyWithDesc(!copyWithDesc),
    },
    {
      icon: <Users className="group-hover:scale-110 transition-transform duration-300" size={20} />,
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
    // {
    //   icon: <LayoutGrid className="group-hover:scale-110 transition-transform duration-300" size={20} />,
    //   tooltip: "显示缩略图",
    //   isActive: isMinimapVisible,
    //   onClick: () => setIsMinimapVisible(!isMinimapVisible),
    // },
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
      needContent: false,
      onClick: () => setIsNavVisible(!isNavVisible),
    },
  ];

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

              return (
                <Fragment key={index}>
                  <ToolbarButton className={cn((tool.needContent && !hasContent) && 'opacity-50 pointer-events-none')} key={index} {...tool} />
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
