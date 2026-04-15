export const runtime = 'edge';

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, caller } from "@/trpc/server";

import { ProjectView } from "@/modules/projects/ui/views/project-view";

interface Props {
  params: Promise<{
    projectId: string;
  }>
};

const Page = async ({ params }: Props) => {
  const { projectId } = await params;

  const queryClient = getQueryClient();
  
  // Prefetching using the caller
  await queryClient.prefetchQuery({
    queryKey: [["messages", "getMany"], { input: { projectId }, type: "query" }],
    queryFn: () => caller.messages.getMany({ projectId }),
  });
  
  await queryClient.prefetchQuery({
    queryKey: [["projects", "getOne"], { input: { id: projectId }, type: "query" }],
    queryFn: () => caller.projects.getOne({ id: projectId }),
  });

  return ( 
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ErrorBoundary fallback={<p>Error!</p>}>
        <Suspense fallback={<p>Loading Project...</p>}>
          <ProjectView projectId={projectId} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
};
 
export default Page;

