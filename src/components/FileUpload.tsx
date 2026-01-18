import { useState, useRef } from "react";
import { Upload, File, X, Image, FileText } from "lucide-react";

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  base64?: string;
}

interface FileUploadProps {
  onFileProcessed: (file: UploadedFile) => void;
  disabled?: boolean;
}

const FileUpload = ({ onFileProcessed, disabled }: FileUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "text/plain",
    "text/csv",
    "application/json",
    "text/markdown",
  ];

  // For the input accept attribute, include extensions too
  const acceptString = ".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv,.json,.md,application/pdf,image/*,text/*";

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const processFile = async (file: File): Promise<UploadedFile> => {
    const uploadedFile: UploadedFile = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
    };

    if (file.type.startsWith("image/")) {
      // Convert image to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // Remove data URL prefix
        };
        reader.readAsDataURL(file);
      });
      uploadedFile.base64 = base64;
    } else if (file.type === "application/pdf") {
      // For PDF, we'll send base64 and let the AI process it
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });
      uploadedFile.base64 = base64;
    } else {
      // Text-based files
      const content = await file.text();
      uploadedFile.content = content;
    }

    return uploadedFile;
  };

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (!acceptedMimeTypes.includes(file.type) && !file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
        console.warn(`File type not supported: ${file.type}`);
        continue;
      }

      const processed = await processFile(file);
      setUploadedFiles((prev) => [...prev, processed]);
      onFileProcessed(processed);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full space-y-3">
      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer ${
          isDragOver
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/30 hover:border-primary/50"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptString}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          disabled={disabled}
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <Upload className="w-6 h-6 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Drop files here</p>
            <p className="text-xs text-muted-foreground">PDF, Images, Text files</p>
          </div>
        </div>
      </div>

      {/* Uploaded files list */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0">
                {getFileIcon(file.type)}
                <span className="text-xs font-medium truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatSize(file.size)}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.id);
                }}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
