import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ 
  id: process.env.NODE_ENV === "production" ? "vibe-joyful" : "vibe-development",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

if (!process.env.INNGEST_EVENT_KEY && process.env.NODE_ENV === "production") {
  console.warn("INNGEST_EVENT_KEY is missing. Inngest events will fail to send in production.");
}
