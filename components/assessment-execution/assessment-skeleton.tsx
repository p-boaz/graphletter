"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AssessmentExecutionSkeleton() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<Skeleton className="mb-2 h-8 w-64" />
					<Skeleton className="h-5 w-96" />
				</div>
				<Skeleton className="h-10 w-32" />
			</div>

			<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
				{Array.from({ length: 5 }).map((_, i) => (
					<Card key={i}>
						<CardContent className="p-4 text-center">
							<Skeleton className="mx-auto mb-1 h-8 w-12" />
							<Skeleton className="mx-auto h-4 w-20" />
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardContent className="p-4">
					<div className="flex gap-4">
						<Skeleton className="h-10 flex-1" />
						<Skeleton className="h-10 w-32" />
						<Skeleton className="h-10 w-32" />
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-64" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-32 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
