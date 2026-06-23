import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { Loader2, Upload, X, File, Image, Video, FileText } from "lucide-react"

export interface UploadedFile {
  name: string
  url: string
  size: number
  type: string
}

interface FileUploadProps {
  bucket: string
  accept?: string
  maxSizeMB?: number
  maxFiles?: number
  files: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  path?: string
  acceptLabel?: string
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="h-5 w-5 text-blue-500" />
  if (type.startsWith("video/")) return <Video className="h-5 w-5 text-purple-500" />
  if (type === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />
  return <File className="h-5 w-5 text-muted-foreground" />
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileUpload({
  bucket,
  accept = "image/*,video/*",
  maxSizeMB = 10,
  maxFiles = 5,
  files,
  onChange,
  path: basePath = "",
  acceptLabel,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const maxBytes = maxSizeMB * 1024 * 1024

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || [])
    setError("")

    if (files.length + selectedFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} file${maxFiles > 1 ? "s" : ""} allowed`)
      return
    }

    const oversized = selectedFiles.find((f) => f.size > maxBytes)
    if (oversized) {
      setError(`File "${oversized.name}" exceeds ${maxSizeMB}MB limit`)
      return
    }

    setUploading(true)
    try {
      const uploaded: UploadedFile[] = []

      for (const file of selectedFiles) {
        const timestamp = Date.now()
        const safeName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
        const filePath = basePath ? `${basePath}/${safeName}` : safeName

        const { data, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          })

        if (uploadError) throw new Error(uploadError.message)

        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(data.path)

        uploaded.push({
          name: file.name,
          url: urlData.publicUrl,
          size: file.size,
          type: file.type,
        })
      }

      onChange([...files, ...uploaded])
    } catch (err: any) {
      setError(err?.message || "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {/* Drop zone / button */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer hover:border-primary/50 hover:bg-muted/30",
          uploading ? "pointer-events-none opacity-60" : ""
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          className="hidden"
          onChange={handleSelect}
          disabled={uploading}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {acceptLabel || `Drop files here or click to upload`}
            </p>
            <p className="text-xs text-muted-foreground/60">
              Max {maxFiles} file{maxFiles > 1 ? "s" : ""}, up to {maxSizeMB}MB each
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
            >
              {getFileIcon(file.type)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{file.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              {file.type.startsWith("image/") && (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Image className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </a>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(idx)
                }}
                className="shrink-0 rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
