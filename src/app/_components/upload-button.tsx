import React from 'react'
import { cn } from '~/lib/utils'


type UploadButtonProps = {
  onClick: () => void
  className?: string
}


const UploadButton = ({ onClick, className }: UploadButtonProps) => {
  return (
    <button onClick={onClick} className={cn("border-none flex px-4 py-2 bg-[#488aec] text-white text-xs font-bold text-center cursor-pointer uppercase align-middle items-center rounded-lg select-none gap-3 shadow-[0_4px_6px_-1px_#488aec31,0_2px_4px_-1px_#488aec17] transition-all duration-600 ease-in-out hover:shadow-[0_10px_15px_-3px_#488aec4f,0_4px_6px_-2px_#488aec17] focus:opacity-85 focus:shadow-none active:opacity-85 active:shadow-none", className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="24"
        height="24"
      >
        <path
          stroke="#fffffff"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 3H8a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h3m2.5-18L19 8.625M13.5 3v4.625a1 1 0 0 0 1 1H19m0 0v3.188M17 15v3m0 3v-3m0 0h-3m3 0h3"
        />
      </svg>
      上传文件
    </button>
  )
}

export default UploadButton
