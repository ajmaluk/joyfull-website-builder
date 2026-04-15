import { z } from "zod";

import { createClerkClient } from "@clerk/nextjs/server";
import { openai, createAgent, createTool, createNetwork, type Tool, type Message, createState } from "@inngest/agent-kit";

import { supabase } from "@/lib/supabase";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";
import { PRO_PLAN_ID, ENTERPRISE_PLAN_ID } from "@/lib/constants";

import { inngest } from "./client";
import { SANDBOX_TIMEOUT } from "./types";
import { getSandbox, lastAssistantTextMessageContent, parseAgentOutput } from "./utils";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
};

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const { hasAdvancedAI } = await step.run("check-features", async () => {
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const user = await clerk.users.getUser(event.data.userId);
      const memberships = await clerk.users.getOrganizationMembershipList({ userId: event.data.userId });
      
      // Production-ready check: check subscription data first, then fallback to publicMetadata
      const plan = (user.publicMetadata as Record<string, unknown>)?.plan;
      const hasProOrEnterpriseSubscription = memberships.data?.some(
        (m: { publicMetadata?: { plan?: unknown } }) => m.publicMetadata?.plan === PRO_PLAN_ID || m.publicMetadata?.plan === ENTERPRISE_PLAN_ID
      );
      
      const isProOrEnterprise = plan === PRO_PLAN_ID || plan === ENTERPRISE_PLAN_ID || hasProOrEnterpriseSubscription;

      return {
        hasAdvancedAI: !!isProOrEnterprise,
      };
    });

    const sandboxId = await step.run("get-sandbox-id", async () => {
      const { Sandbox } = await import("@e2b/code-interpreter");
      const templateId = process.env.NEXT_PUBLIC_E2B_TEMPLATE_ID || "vibe-nextjs-test-2";
      const sandbox = await Sandbox.create(templateId);
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox.sandboxId;
    });


    const previousMessages = await step.run("get-previous-messages", async () => {
      const formattedMessages: Message[] = [];

      const { data: messages, error } = await supabase
        .from('Message')
        .select('*')
        .eq('projectId', event.data.projectId)
        .order('createdAt', { ascending: false })
        .limit(5);

      if (error || !messages) {
        return [];
      }

      for (const message of messages) {
        formattedMessages.push({
          type: "text",
          role: message.role === "ASSISTANT" ? "assistant" : "user",
          content: message.content,
        })
      }

      return formattedMessages.reverse();
    });

    const state = createState<AgentState>(
      {
        summary: "",
        files: {},
      },
      {
        messages: previousMessages,
      },
    );

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: openai({ 
        model: hasAdvancedAI ? "gpt-4o" : "gpt-4o-mini",
        defaultParameters: {
          temperature: 0.1,
        },
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: "" };

              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  }
                });
                return result.stdout;
              } catch (e) {
                console.error(
                  `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`,
                );
                return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              }),
            ),
          }),
          handler: async (
            { files },
            { step, network }: Tool.Options<AgentState>
          ) => {
            const newFiles = await step?.run("createOrUpdateFiles", async () => {
              try {
                const updatedFiles = network.state.data.files || {};
                const sandbox = await getSandbox(sandboxId);
                for (const file of files) {
                  await sandbox.files.write(file.path, file.content);
                  updatedFiles[file.path] = file.content;
                }

                return updatedFiles;
              } catch (e) {
                return "Error: " + e;
              }
            });

            if (typeof newFiles === "object") {
              network.state.data.files = newFiles;
            }
          }
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const contents = [];
                for (const file of files) {
                  const content = await sandbox.files.read(file);
                  contents.push({ path: file, content });
                }
                return JSON.stringify(contents);
              } catch (e) {
                return "Error: " + e;
              }
            })
          },
        })
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText =
            lastAssistantTextMessageContent(result);

          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }

          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: hasAdvancedAI ? 15 : 5,
      defaultState: state,
      router: async ({ network }) => {
        const summary = network.state.data.summary;

        if (summary) {
          return;
        }

        return codeAgent;
      },
    });

    const result = await network.run(event.data.value, { state });

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({ 
        model: "gpt-4o",
      }),
    })

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: openai({ 
        model: "gpt-4o",
      }),
    });

    const { 
      output: fragmentTitleOuput
    } = await fragmentTitleGenerator.run(result.state.data.summary);
    const { 
      output: responseOutput
    } = await responseGenerator.run(result.state.data.summary);

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("save-result", async () => {
      if (isError) {
        return await supabase.from('Message').insert({
          projectId: event.data.projectId,
          content: "Something went wrong. Please try again.",
          role: "ASSISTANT",
          type: "ERROR",
        }).select().single();
      }

      // 1. Create message
      const { data: createdMessage, error: messageError } = await supabase
        .from('Message')
        .insert({
          projectId: event.data.projectId,
          content: parseAgentOutput(responseOutput),
          role: "ASSISTANT",
          type: "RESULT",
        })
        .select()
        .single();

      if (messageError || !createdMessage) {
        throw new Error("Failed to save message result");
      }

      // 2. Create fragment
      const { error: fragmentError } = await supabase
        .from('Fragment')
        .insert({
          messageId: createdMessage.id,
          sandboxUrl: sandboxUrl,
          title: parseAgentOutput(fragmentTitleOuput),
          files: result.state.data.files,
        });

      if (fragmentError) {
        throw new Error("Failed to save fragment result");
      }

      return createdMessage;
    });

    const response = await step.run("cleanup-sandbox", async () => {
      try {
        const sandbox = await getSandbox(sandboxId);
        await sandbox.kill();
      } catch (e) {
        console.error("Failed to close sandbox:", e);
      }

      return { 
        url: sandboxUrl,
        title: "Fragment",
        files: result.state.data.files,
        summary: result.state.data.summary,
      };
    });

    return response;
  },
);
