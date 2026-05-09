import { createClient } from "@/lib/supabase/client";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export interface UploadProgress {
	loaded: number;
	total: number;
	percentage: number;
}

export interface UploadResult {
	success: boolean;
	path?: string;
	error?: string;
}

export interface DownloadResult {
	success: boolean;
	url?: string;
	error?: string;
}

/**
 * Evidence storage utilities for handling file uploads and downloads
 */
export class EvidenceStorage {
	private supabase = createClient();
	private bucketName = "compliance-documents";

	/**
	 * Upload evidence file to Supabase storage
	 */
	async uploadEvidence(
		file: File,
		userId: string,
		filename?: string,
		_onProgress?: (progress: UploadProgress) => void,
	): Promise<UploadResult> {
		void _onProgress;
		try {
			// Generate unique filename if not provided
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const fileExtension = file.name.split(".").pop();
			const finalFilename =
				filename || `evidence_${timestamp}.${fileExtension}`;

			// Create file path: userId/evidence/filename
			const filePath = `${userId}/evidence/${finalFilename}`;

			// Validate file size (50MB limit)
			if (file.size > 50 * 1024 * 1024) {
				return {
					success: false,
					error: "File size must be less than 50MB",
				};
			}

			// Validate file type
			const allowedTypes = [
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
				"application/json",
				"text/json",
			];

			if (!allowedTypes.includes(file.type)) {
				return {
					success: false,
					error:
						"File type not supported. Please upload PDF, Word, Excel, text, image, or JSON files.",
				};
			}

			// Upload file with progress tracking
			const { data, error } = await this.supabase.storage
				.from(this.bucketName)
				.upload(filePath, file, {
					upsert: false,
					contentType: file.type,
				});

			if (error) {
				return {
					success: false,
					error: `Upload failed: ${error.message}`,
				};
			}

			return {
				success: true,
				path: data.path,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Upload failed",
			};
		}
	}

	/**
	 * Upload JSON data as evidence file to Supabase storage
	 */
	async uploadJsonEvidence(
		jsonData: unknown,
		userId: string,
		filename: string,
		description?: string,
		supabaseClient?: SupabaseBrowserClient,
	): Promise<UploadResult> {
		try {
			// Create JSON file content
			const jsonContent = JSON.stringify(jsonData, null, 2);
			const jsonBlob = new Blob([jsonContent], { type: "text/plain" });

			// Generate unique filename
			const finalFilename = filename.endsWith(".json")
				? filename
				: `${filename}.json`;

			// Create file path: userId/evidence/automated/filename
			const filePath = `${userId}/evidence/automated/${finalFilename}`;

			// Validate size (JSON files should be much smaller)
			if (jsonBlob.size > 10 * 1024 * 1024) {
				// 10MB limit for JSON
				return {
					success: false,
					error: "JSON file size must be less than 10MB",
				};
			}

			// Use provided client or fallback to instance client
			const client = supabaseClient || this.supabase;

			// Upload JSON file (use text/plain content type for Supabase compatibility)
			const { data, error } = await client.storage
				.from(this.bucketName)
				.upload(filePath, jsonBlob, {
					upsert: false,
					contentType: "text/plain",
					metadata: {
						originalName: finalFilename,
						description: description || "Automated evidence",
						uploadType: "automated",
						timestamp: new Date().toISOString(),
						actualContentType: "application/json",
					},
				});

			if (error) {
				console.error("JSON upload error details:", error);
				return {
					success: false,
					error: `JSON upload failed: ${error.message}`,
				};
			}

			return {
				success: true,
				path: data.path,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "JSON upload failed",
			};
		}
	}

	/**
	 * Get download URL for evidence file
	 */
	async getDownloadUrl(
		filePath: string,
		expiresIn: number = 3600,
	): Promise<DownloadResult> {
		try {
			const { data, error } = await this.supabase.storage
				.from(this.bucketName)
				.createSignedUrl(filePath, expiresIn);

			if (error) {
				return {
					success: false,
					error: `Failed to generate download URL: ${error.message}`,
				};
			}

			return {
				success: true,
				url: data.signedUrl,
			};
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to generate download URL",
			};
		}
	}

	/**
	 * Delete evidence file from storage
	 */
	async deleteEvidence(filePath: string): Promise<UploadResult> {
		try {
			const { error } = await this.supabase.storage
				.from(this.bucketName)
				.remove([filePath]);

			if (error) {
				return {
					success: false,
					error: `Delete failed: ${error.message}`,
				};
			}

			return {
				success: true,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Delete failed",
			};
		}
	}

	/**
	 * List evidence files for a user
	 */
	async listUserEvidence(userId: string) {
		try {
			const { data, error } = await this.supabase.storage
				.from(this.bucketName)
				.list(`${userId}/evidence/`, {
					limit: 100,
					offset: 0,
					sortBy: { column: "created_at", order: "desc" },
				});

			if (error) {
				throw new Error(`Failed to list evidence: ${error.message}`);
			}

			return data || [];
		} catch (error) {
			console.error("Error listing user evidence:", error);
			return [];
		}
	}

	/**
	 * Get file info from storage
	 */
	async getFileInfo(filePath: string) {
		try {
			const { data, error } = await this.supabase.storage
				.from(this.bucketName)
				.list(filePath.split("/").slice(0, -1).join("/"), {
					limit: 1,
					search: filePath.split("/").pop(),
				});

			if (error) {
				throw new Error(`Failed to get file info: ${error.message}`);
			}

			return data?.[0] || null;
		} catch (error) {
			console.error("Error getting file info:", error);
			return null;
		}
	}

	/**
	 * Copy file to new location
	 */
	async copyEvidence(fromPath: string, toPath: string): Promise<UploadResult> {
		try {
			const { error } = await this.supabase.storage
				.from(this.bucketName)
				.copy(fromPath, toPath);

			if (error) {
				return {
					success: false,
					error: `Copy failed: ${error.message}`,
				};
			}

			return {
				success: true,
				path: toPath,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Copy failed",
			};
		}
	}

	/**
	 * Move file to new location
	 */
	async moveEvidence(fromPath: string, toPath: string): Promise<UploadResult> {
		try {
			const { error } = await this.supabase.storage
				.from(this.bucketName)
				.move(fromPath, toPath);

			if (error) {
				return {
					success: false,
					error: `Move failed: ${error.message}`,
				};
			}

			return {
				success: true,
				path: toPath,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Move failed",
			};
		}
	}

	/**
	 * Generate public URL for file (if bucket is public)
	 */
	getPublicUrl(filePath: string) {
		const { data } = this.supabase.storage
			.from(this.bucketName)
			.getPublicUrl(filePath);

		return data.publicUrl;
	}

	/**
	 * Check if file exists
	 */
	async fileExists(filePath: string): Promise<boolean> {
		try {
			const fileInfo = await this.getFileInfo(filePath);
			return fileInfo !== null;
		} catch {
			return false;
		}
	}

	/**
	 * Get storage usage statistics for a user
	 */
	async getUserStorageStats(userId: string) {
		try {
			const files = await this.listUserEvidence(userId);

			const stats = {
				totalFiles: files.length,
				totalSize: files.reduce(
					(sum, file) => sum + (file.metadata?.size || 0),
					0,
				),
				fileTypes: {} as Record<string, number>,
				oldestFile: null as Date | null,
				newestFile: null as Date | null,
			};

			files.forEach((file) => {
				const extension =
					file.name.split(".").pop()?.toLowerCase() || "unknown";
				stats.fileTypes[extension] = (stats.fileTypes[extension] || 0) + 1;

				const createdAt = new Date(file.created_at);
				if (!stats.oldestFile || createdAt < stats.oldestFile) {
					stats.oldestFile = createdAt;
				}
				if (!stats.newestFile || createdAt > stats.newestFile) {
					stats.newestFile = createdAt;
				}
			});

			return stats;
		} catch (error) {
			console.error("Error getting storage stats:", error);
			return {
				totalFiles: 0,
				totalSize: 0,
				fileTypes: {},
				oldestFile: null,
				newestFile: null,
			};
		}
	}
}

// Export singleton instance
export const evidenceStorage = new EvidenceStorage();
