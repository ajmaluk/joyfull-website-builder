export type MessageRole = "USER" | "ASSISTANT";
export type MessageType = "RESULT" | "ERROR";

export interface Project {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  type: MessageType;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  fragment?: Fragment | null;
}

export interface Fragment {
  id: string;
  messageId: string;
  sandboxUrl: string;
  title: string;
  files: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Usage {
  key: string;
  points: number;
  expire: string | null;
}

export type TreeItem = string | [string, ...TreeItem[]];
