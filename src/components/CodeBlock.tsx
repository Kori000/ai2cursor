import { toast } from "sonner"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import { Copy } from "lucide-react"

interface CodeBlockProps {
  code: string;
  rawCode?: string;
  className?: string;
}

export function CodeBlock({ code, rawCode, className = "" }: CodeBlockProps) {
  const copyCode = () => {
    const textToCopy = rawCode ?? code.replace(/<\/?[^>]+(>|$)/g, "");

    navigator.clipboard.writeText(textToCopy).then(
      () => {
        toast.success('已复制到剪贴板')
      },
      (err) => {
        console.error('无法复制文本: ', err);
        toast.error('复制失败');
      }
    );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <pre
          className={`bg-[#2d2d2d] text-[#ffffff] p-3 rounded font-mono text-sm overflow-x-auto ${className}`}
          dangerouslySetInnerHTML={{
            __html: code
          }}
        />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={copyCode}>
          <Copy className="mr-2 h-4 w-4" />
          <span>复制代码</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
} 
