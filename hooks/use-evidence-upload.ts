import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  evidenceStorage,
  type UploadProgress,
  type UploadResult,
} from "@/lib/storage/evidence-storage";

export interface UseEvidenceUploadOptions {
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: UploadProgress) => void;
  maxFileSize?: number; // in bytes
  allowedTypes?: string[];
}

export interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  uploadedFiles: UploadResult[];
}

export function useEvidenceUpload(userId: string, options: UseEvidenceUploadOptions = {}) {
  const {
    onSuccess,
    onError,
    onProgress,
    maxFileSize = 50 * 1024 * 1024, // 50MB default
    allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
      "image/png",
      "image/jpeg",
      "image/gif",
    ],
  } = options;

  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    uploadedFiles: [],
  });

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxFileSize) {
        return `File size must be less than ${Math.round(maxFileSize / 1024 / 1024)}MB`;
      }

      if (!allowedTypes.includes(file.type)) {
        return "File type not supported. Please upload PDF, Word, Excel, text, or image files.";
      }

      return null;
    },
    [maxFileSize, allowedTypes]
  );

  const uploadFile = useCallback(
    async (file: File, filename?: string): Promise<UploadResult> => {
      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        const error = validationError;
        setUploadState((prev) => ({ ...prev, error }));
        onError?.(error);
        toast.error(error);
        return { success: false, error };
      }

      setUploadState((prev) => ({
        ...prev,
        isUploading: true,
        progress: 0,
        error: null,
      }));

      try {
        const result = await evidenceStorage.uploadEvidence(file, userId, filename, (progress) => {
          setUploadState((prev) => ({
            ...prev,
            progress: progress.percentage,
          }));
          onProgress?.(progress);
        });

        if (result.success) {
          setUploadState((prev) => ({
            ...prev,
            isUploading: false,
            progress: 100,
            uploadedFiles: [...prev.uploadedFiles, result],
          }));

          onSuccess?.(result);
          toast.success(`File uploaded successfully: ${file.name}`);
        } else {
          setUploadState((prev) => ({
            ...prev,
            isUploading: false,
            error: result.error || "Upload failed",
          }));

          onError?.(result.error || "Upload failed");
          toast.error(result.error || "Upload failed");
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Upload failed";

        setUploadState((prev) => ({
          ...prev,
          isUploading: false,
          error: errorMessage,
        }));

        onError?.(errorMessage);
        toast.error(errorMessage);

        return { success: false, error: errorMessage };
      }
    },
    [userId, validateFile, onSuccess, onError, onProgress]
  );

  const uploadFiles = useCallback(
    async (files: File[]): Promise<UploadResult[]> => {
      const results: UploadResult[] = [];

      for (const file of files) {
        const result = await uploadFile(file);
        results.push(result);

        // Add small delay between uploads to prevent overwhelming the server
        if (files.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      return results;
    },
    [uploadFile]
  );

  const resetUploadState = useCallback(() => {
    setUploadState({
      isUploading: false,
      progress: 0,
      error: null,
      uploadedFiles: [],
    });
  }, []);

  const clearError = useCallback(() => {
    setUploadState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    uploadState,
    uploadFile,
    uploadFiles,
    resetUploadState,
    clearError,
    validateFile,
  };
}

// Hook for downloading evidence files
export function useEvidenceDownload() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadFile = useCallback(async (filePath: string, filename?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await evidenceStorage.getDownloadUrl(filePath);

      if (result.success && result.url) {
        // Create download link and trigger download
        const link = document.createElement("a");
        link.href = result.url;
        link.download = filename || filePath.split("/").pop() || "evidence-file";
        link.target = "_blank";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Download started");
      } else {
        const errorMsg = result.error || "Failed to download file";
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Download failed";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getViewUrl = useCallback(async (filePath: string) => {
    try {
      const result = await evidenceStorage.getDownloadUrl(filePath, 3600); // 1 hour expiry
      return result.success ? result.url : null;
    } catch (error) {
      console.error("Error getting view URL:", error);
      return null;
    }
  }, []);

  return {
    isLoading,
    error,
    downloadFile,
    getViewUrl,
    clearError: () => setError(null),
  };
}

// Hook for managing evidence files
export function useEvidenceManager(userId: string) {
  type EvidenceFile = Awaited<ReturnType<(typeof evidenceStorage)["listUserEvidence"]>>[number];

  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fileList = await evidenceStorage.listUserEvidence(userId);
      setFiles(fileList);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to load files";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const deleteFile = useCallback(async (filePath: string) => {
    try {
      const result = await evidenceStorage.deleteEvidence(filePath);

      if (result.success) {
        setFiles((prev) => prev.filter((file) => !filePath.endsWith(file.name)));
        toast.success("File deleted successfully");
      } else {
        toast.error(result.error || "Failed to delete file");
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Delete failed";
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  const getStorageStats = useCallback(async () => {
    try {
      return await evidenceStorage.getUserStorageStats(userId);
    } catch (error) {
      console.error("Error getting storage stats:", error);
      return null;
    }
  }, [userId]);

  return {
    isLoading,
    files,
    error,
    loadFiles,
    deleteFile,
    getStorageStats,
    clearError: () => setError(null),
  };
}
