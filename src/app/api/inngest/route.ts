import { serve } from "inngest/next";

export const runtime = 'edge';

import { inngest } from "@/inngest/client";
import { codeAgentFunction } from "@/inngest/functions";
import { syncClerkMetadata } from "@/inngest/sync";

// Create an API that serves zero functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    codeAgentFunction,
    syncClerkMetadata,
  ],
});
