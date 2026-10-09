import { createFileRoute } from "@tanstack/react-router";
import { StudentShell } from "@/components/StudentShell";
import { ChatThread } from "@/components/ChatThread";
import { useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — SCHOLARS CBT" },
      { name: "description", content: "Chat with your school admin and examiners." },
      { property: "og:title", content: "Messages — SCHOLARS CBT" },
      { property: "og:description", content: "Chat with your school admin and examiners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentMessages,
});

function StudentMessages() {
  const { data: me } = useMe();
  return (
    <StudentShell>
      <h1 className="text-2xl font-extrabold">Messages</h1>
      <p className="mb-4 text-sm text-muted-foreground">Send a message to your school admin. Replies appear here.</p>
      {me ? <ChatThread studentId={me.user.id} me="student" /> : <p>Loading...</p>}
    </StudentShell>
  );
}
