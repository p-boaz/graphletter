"use client";

import {
	AlertTriangle,
	CheckCircle,
	Database,
	Download,
	Eye,
	FileSpreadsheet,
	Network,
	Shield,
	Upload,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SCFImportResult } from "@/lib/scf-types";

type SCFImportResultWithImportId = SCFImportResult & {
	importId?: string;
};

export function SCFImport() {
	const [isImporting, setIsImporting] = useState(false);
	const [importProgress, setImportProgress] = useState(0);
	const [importResult, setImportResult] =
		useState<SCFImportResultWithImportId | null>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [error, setError] = useState<string | null>(null);

	const onDrop = useCallback(async (acceptedFiles: File[]) => {
		if (acceptedFiles.length === 0) return;

		const file = acceptedFiles[0];
		setSelectedFile(file);
		setError(null);

		// Validate file type
		if (
			!file.name.toLowerCase().endsWith(".xlsx") &&
			!file.name.toLowerCase().endsWith(".xls") &&
			!file.name.toLowerCase().endsWith(".csv")
		) {
			setError(
				"Please upload an Excel file (.xlsx or .xls) or CSV file (.csv)",
			);
			return;
		}

		// Check if it looks like an SCF file
		if (!file.name.toLowerCase().includes("scf")) {
			setError(
				"File doesn't appear to be an SCF file. Please ensure you're uploading the correct SCF Excel or CSV file.",
			);
			return;
		}

		console.log("SCF file selected:", file.name, file.size);
	}, []);

	const handleImport = async () => {
		if (!selectedFile) return;

		setIsImporting(true);
		setError(null);
		setImportProgress(0);

		try {
			// Simulate import progress
			const progressInterval = setInterval(() => {
				setImportProgress((prev) => {
					if (prev >= 90) {
						clearInterval(progressInterval);
						return 90;
					}
					return prev + 10;
				});
			}, 500);

			const formData = new FormData();
			formData.append("file", selectedFile);

			console.log("Starting SCF import...");

			const response = await fetch("/api/scf/import", {
				method: "POST",
				body: formData,
			});

			const result = await response.json();

			clearInterval(progressInterval);
			setImportProgress(100);

			if (result.success) {
				setImportResult(result.data as SCFImportResultWithImportId);
				console.log("SCF import successful:", result.data.summary);
			} else {
				setError(result.error || "Failed to import SCF data");
				console.error("SCF import failed:", result);
			}
		} catch (error) {
			console.error("Import error:", error);
			setError(
				`Failed to import SCF data: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		} finally {
			setIsImporting(false);
			setTimeout(() => setImportProgress(0), 1000);
		}
	};

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: {
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
				".xlsx",
			],
			"application/vnd.ms-excel": [".xls"],
			"text/csv": [".csv"],
		},
		maxFiles: 1,
		maxSize: 50 * 1024 * 1024, // 50MB
	});

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
	};

	return (
		<div className="space-y-6">
			<div className="border-slate-200 border-b pb-6">
				<h2 className="font-semibold text-2xl text-slate-800 tracking-tight">
					SCF Data Import
				</h2>
				<p className="mt-1 text-slate-600">
					Import Secure Controls Framework (SCF) data to populate the platform
					with comprehensive control mappings
				</p>
			</div>

			{/* Import Section */}
			<Card className="border-2 border-slate-300 border-dashed bg-slate-50/50">
				<CardHeader>
					<CardTitle className="flex items-center space-x-2">
						<Upload className="h-5 w-5 text-slate-600" />
						<span>Upload SCF Excel File</span>
					</CardTitle>
					<CardDescription>
						Upload the official SCF Excel file (SCF 2025.1.1 or later) or CSV
						export to import controls, mappings, and metadata
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* File Upload */}
					<div
						{...getRootProps()}
						className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
							isDragActive
								? "border-blue-400 bg-blue-50"
								: "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
						}`}
					>
						<input {...getInputProps()} />
						<div className="space-y-4">
							<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
								<FileSpreadsheet className="h-6 w-6 text-slate-600" />
							</div>
							{isDragActive ? (
								<p className="font-medium text-blue-600">
									Drop the SCF Excel file here...
								</p>
							) : (
								<div>
									<p className="font-medium text-slate-700">
										Drag & drop the SCF Excel or CSV file here, or click to
										select
									</p>
									<p className="mt-1 text-slate-500 text-sm">
										Supports .xlsx, .xls, and .csv files (max 50MB)
									</p>
								</div>
							)}
						</div>
					</div>

					{/* Selected File Info */}
					{selectedFile && (
						<div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center space-x-3">
									<FileSpreadsheet className="h-5 w-5 text-blue-600" />
									<div>
										<p className="font-medium text-blue-900">
											{selectedFile.name}
										</p>
										<p className="text-blue-700 text-sm">
											{formatFileSize(selectedFile.size)}
										</p>
									</div>
								</div>
								<Button
									onClick={handleImport}
									disabled={isImporting}
									className="bg-blue-600 text-white hover:bg-blue-700"
								>
									{isImporting ? "Importing..." : "Import SCF Data"}
								</Button>
							</div>
						</div>
					)}

					{/* Import Progress */}
					{isImporting && (
						<div className="space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="text-slate-600">Processing SCF data...</span>
								<span className="text-slate-600">{importProgress}%</span>
							</div>
							<Progress value={importProgress} className="bg-slate-200" />
							<p className="text-slate-500 text-xs">
								Parsing Excel sheets, extracting controls, and building
								mappings...
							</p>
						</div>
					)}

					{/* Error Display */}
					{error && (
						<Alert className="border-red-200 bg-red-50">
							<AlertTriangle className="h-4 w-4 text-red-600" />
							<AlertDescription className="text-red-800">
								{error}
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

			{/* Import Results */}
			{importResult && (
				<div className="space-y-6">
					{/* Summary Card */}
					<Card className="border-l-4 border-l-emerald-400 bg-emerald-50/30">
						<CardHeader>
							<CardTitle className="flex items-center space-x-2 text-emerald-800">
								<CheckCircle className="h-5 w-5" />
								<span>SCF Import Successful</span>
							</CardTitle>
							<CardDescription className="text-emerald-700">
								SCF {importResult.summary.version} data has been successfully
								imported
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
								<div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
									<div className="font-semibold text-2xl text-emerald-800">
										{importResult.summary.totalControls}
									</div>
									<div className="text-emerald-600 text-sm">Controls</div>
								</div>
								<div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
									<div className="font-semibold text-2xl text-emerald-800">
										{importResult.summary.totalDomains}
									</div>
									<div className="text-emerald-600 text-sm">Domains</div>
								</div>
								<div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
									<div className="font-semibold text-2xl text-emerald-800">
										{importResult.summary.totalFrameworks}
									</div>
									<div className="text-emerald-600 text-sm">Frameworks</div>
								</div>
								<div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
									<div className="font-semibold text-2xl text-emerald-800">
										{importResult.summary.totalMappings.toLocaleString()}
									</div>
									<div className="text-emerald-600 text-sm">Mappings</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Storage Status Card */}
					{importResult && (
						<Card className="border-l-4 border-l-blue-400 bg-blue-50/30">
							<CardHeader>
								<CardTitle className="flex items-center space-x-2 text-blue-800">
									<Database className="h-5 w-5" />
									<span>Data Storage Status</span>
								</CardTitle>
								<CardDescription className="text-blue-700">
									SCF data has been successfully stored in the database and is
									ready for use
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									<div className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-3">
										<div className="flex items-center space-x-2">
											<CheckCircle className="h-4 w-4 text-emerald-600" />
											<span className="font-medium text-slate-800 text-sm">
												Controls Database
											</span>
										</div>
										<Badge
											variant="outline"
											className="border-emerald-200 bg-emerald-50 text-emerald-700"
										>
											{importResult.summary.totalControls} stored
										</Badge>
									</div>

									<div className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-3">
										<div className="flex items-center space-x-2">
											<CheckCircle className="h-4 w-4 text-emerald-600" />
											<span className="font-medium text-slate-800 text-sm">
												Framework Mappings
											</span>
										</div>
										<Badge
											variant="outline"
											className="border-emerald-200 bg-emerald-50 text-emerald-700"
										>
											{importResult.summary.totalMappings.toLocaleString()}{" "}
											stored
										</Badge>
									</div>

									<div className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-3">
										<div className="flex items-center space-x-2">
											<CheckCircle className="h-4 w-4 text-emerald-600" />
											<span className="font-medium text-slate-800 text-sm">
												Domain Structure
											</span>
										</div>
										<Badge
											variant="outline"
											className="border-emerald-200 bg-emerald-50 text-emerald-700"
										>
											{importResult.summary.totalDomains} stored
										</Badge>
									</div>

									{importResult.importId && (
										<div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
											<div className="text-slate-600 text-xs">
												<span className="font-medium">Import Session ID:</span>{" "}
												{importResult.importId}
											</div>
											<div className="mt-1 text-slate-500 text-xs">
												Use this ID to track this import in audit logs and
												database queries
											</div>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Detailed Results */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center space-x-2">
								<Database className="h-5 w-5 text-slate-600" />
								<span>Import Details</span>
							</CardTitle>
							<CardDescription>
								Detailed breakdown of imported SCF data
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Tabs defaultValue="controls" className="space-y-4">
								<TabsList className="grid w-full grid-cols-4">
									<TabsTrigger value="controls">Controls</TabsTrigger>
									<TabsTrigger value="domains">Domains</TabsTrigger>
									<TabsTrigger value="frameworks">Frameworks</TabsTrigger>
									<TabsTrigger value="mappings">Mappings</TabsTrigger>
								</TabsList>

								<TabsContent value="controls" className="space-y-4">
									<div className="space-y-3">
										<h4 className="font-medium text-slate-800">
											Sample Controls
										</h4>
										{importResult.controls.slice(0, 5).map((control, index) => (
											<div
												key={index}
												className="rounded-lg border border-slate-200 bg-slate-50 p-3"
											>
												<div className="mb-2 flex items-center justify-between">
													<span className="font-medium text-slate-800">
														{control.id}
													</span>
													<Badge variant="outline" className="text-xs">
														{control.domain}
													</Badge>
												</div>
												<h5 className="mb-1 font-medium text-slate-700">
													{control.title}
												</h5>
												<p className="line-clamp-2 text-slate-600 text-sm">
													{control.description}
												</p>
												<div className="mt-2 flex items-center space-x-4 text-slate-500 text-xs">
													<span>
														Mappings: {Object.keys(control.mappings).length}
													</span>
													<span>Risks: {control.riskIds.length}</span>
													<span>
														Evidence: {control.evidenceRequests.length}
													</span>
												</div>
											</div>
										))}
										{importResult.controls.length > 5 && (
											<p className="text-center text-slate-500 text-sm">
												...and {importResult.controls.length - 5} more controls
											</p>
										)}
									</div>
								</TabsContent>

								<TabsContent value="domains" className="space-y-4">
									<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
										{importResult.domains.map((domain, index) => (
											<div
												key={index}
												className="rounded-lg border border-slate-200 bg-slate-50 p-3"
											>
												<div className="mb-2 flex items-center justify-between">
													<span className="font-medium text-slate-800">
														{domain.id}
													</span>
													<Badge variant="outline" className="text-xs">
														{domain.controlCount} controls
													</Badge>
												</div>
												<h5 className="mb-1 font-medium text-slate-700">
													{domain.name}
												</h5>
												<p className="line-clamp-2 text-slate-600 text-sm">
													{domain.description}
												</p>
											</div>
										))}
									</div>
								</TabsContent>

								<TabsContent value="frameworks" className="space-y-4">
									<div className="space-y-3">
										{importResult.frameworks
											.slice(0, 10)
											.map((framework, index) => (
												<div
													key={index}
													className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
												>
													<div>
														<span className="font-medium text-slate-800">
															{framework.frameworkName}
														</span>
														{framework.frameworkVersion && (
															<span className="ml-2 text-slate-600 text-sm">
																v{framework.frameworkVersion}
															</span>
														)}
													</div>
													<div className="flex items-center space-x-2">
														<Badge variant="outline" className="text-xs">
															{framework.totalMappings} mappings
														</Badge>
														<Badge
															variant="outline"
															className={`text-xs ${
																framework.mappingType === "direct"
																	? "bg-emerald-50 text-emerald-700"
																	: framework.mappingType === "partial"
																		? "bg-amber-50 text-amber-700"
																		: "bg-blue-50 text-blue-700"
															}`}
														>
															{framework.mappingType}
														</Badge>
													</div>
												</div>
											))}
									</div>
								</TabsContent>

								<TabsContent value="mappings" className="space-y-4">
									<div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
										<div className="mb-2 flex items-center space-x-2">
											<Network className="h-5 w-5 text-blue-600" />
											<span className="font-medium text-blue-900">
												Mapping Matrix
											</span>
										</div>
										<p className="mb-3 text-blue-800 text-sm">
											The SCF provides{" "}
											{importResult.summary.totalMappings.toLocaleString()}{" "}
											control mappings across{" "}
											{importResult.summary.totalFrameworks} frameworks.
										</p>
										<div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
											{importResult.frameworks
												.slice(0, 6)
												.map((framework, index) => (
													<div
														key={index}
														className="rounded border border-blue-200 bg-white p-2"
													>
														<div className="font-medium text-blue-900">
															{framework.frameworkName}
														</div>
														<div className="text-blue-700">
															{framework.totalMappings} mappings
														</div>
													</div>
												))}
										</div>
									</div>
								</TabsContent>
							</Tabs>
						</CardContent>
					</Card>

					{/* Warnings and Errors */}
					{(importResult.warnings.length > 0 ||
						importResult.errors.length > 0) && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center space-x-2">
									<AlertTriangle className="h-5 w-5 text-amber-600" />
									<span>Import Issues</span>
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{importResult.warnings.length > 0 && (
									<div>
										<h4 className="mb-2 font-medium text-amber-800">
											Warnings
										</h4>
										<ul className="space-y-1">
											{importResult.warnings.map((warning, index) => (
												<li
													key={index}
													className="flex items-start space-x-2 text-amber-700 text-sm"
												>
													<span className="text-amber-600">⚠</span>
													<span>{warning}</span>
												</li>
											))}
										</ul>
									</div>
								)}

								{importResult.errors.length > 0 && (
									<div>
										<h4 className="mb-2 font-medium text-red-800">Errors</h4>
										<ul className="space-y-1">
											{importResult.errors.map((error, index) => (
												<li
													key={index}
													className="flex items-start space-x-2 text-red-700 text-sm"
												>
													<span className="text-red-600">✗</span>
													<span>{error}</span>
												</li>
											))}
										</ul>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{/* Actions */}
					<div className="flex space-x-2">
						<Button
							variant="outline"
							className="border-slate-300 text-slate-700"
						>
							<Eye className="mr-2 h-4 w-4" />
							Browse Controls
						</Button>
						<Button
							variant="outline"
							className="border-slate-300 text-slate-700"
						>
							<Download className="mr-2 h-4 w-4" />
							Export Summary
						</Button>
						<Button className="bg-slate-800 text-white hover:bg-slate-700">
							<Shield className="mr-2 h-4 w-4" />
							Start Analysis
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
