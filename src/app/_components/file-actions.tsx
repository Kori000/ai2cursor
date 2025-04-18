import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { FileText, Upload, X } from "lucide-react";
import MonacoEditor from "@monaco-editor/react";
import exampleJson from '../../../public/example.json';

const PETSTORE_EXAMPLE_URL = "https://petstore3.swagger.io/";

interface FileActionsProps {
  hasContent: boolean;
  onUpload: () => void;
  onClear: () => void;
  onExampleSelect: (content: string) => void;
}

// 自定义按钮组件
const CustomButton = ({
  onClick,
  children,
  variant = 'default',
  className
}: {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'destructive';
  className?: string;
}) => {
  const baseStyles = "border-none flex px-4 py-3 text-white text-xs font-bold text-center cursor-pointer uppercase align-middle items-center rounded-lg select-none gap-3 transition-all duration-600 ease-in-out focus:opacity-85 focus:shadow-none active:opacity-85 active:shadow-none text-center justify-center";

  const variantStyles = {
    default: "bg-[#488aec] shadow-[0_4px_6px_-1px_#488aec31,0_2px_4px_-1px_#488aec17] hover:shadow-[0_10px_15px_-3px_#488aec4f,0_4px_6px_-2px_#488aec17]",
    destructive: "bg-red-500 shadow-[0_4px_6px_-1px_#ef444431,0_2px_4px_-1px_#ef444417] hover:shadow-[0_10px_15px_-3px_#ef44444f,0_4px_6px_-2px_#ef444417]"
  };

  return (
    <button
      onClick={onClick}
      className={cn(baseStyles, variantStyles[variant], className)}
    >
      {children}
    </button>
  );
};

export function FileActions({
  hasContent,
  onUpload,
  onClear,
  onExampleSelect,
}: FileActionsProps) {
  return (
    <div className="flex items-center gap-3">

      {
        !hasContent && (
          <Dialog>
            <DialogTrigger asChild>
              <CustomButton className="bg-white !text-[#488aec] border !border-[#488aec] border-solid">
                <FileText size={16} />
                获取示例
              </CustomButton>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>OpenAPI 示例</DialogTitle>
                <DialogDescription>
                  这是一个 OpenAPI 3.0 的示例文档。你也可以访问{" "}
                  <a
                    href={PETSTORE_EXAMPLE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Swagger Petstore
                  </a>{" "}
                  获取更多示例。
                </DialogDescription>
              </DialogHeader>
              <div className="h-[400px] flex-1  w-full">
                <MonacoEditor
                  height="100%"
                  defaultLanguage="json"
                  value={JSON.stringify(exampleJson, null, 2)}
                  options={{
                    minimap: { enabled: false },
                    readOnly: true,
                  }}
                />
              </div>
              <DialogClose asChild>
                <CustomButton onClick={() => {
                  onExampleSelect(JSON.stringify(exampleJson, null, 2))

                }}>
                  使用此示例
                </CustomButton>
              </DialogClose>
            </DialogContent>
          </Dialog>
        )
      }

      <CustomButton
        variant={hasContent ? "destructive" : "default"}
        onClick={hasContent ? onClear : onUpload}
      >
        {hasContent ? (
          <>
            <X size={16} />
            清除
          </>
        ) : (
          <>
            <Upload size={16} />
            上传文件
          </>
        )}
      </CustomButton>
    </div>
  );
} 
