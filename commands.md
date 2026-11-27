
** ---------------------------------------- **
cat components/ChatConnection.tsx lib/chat-events.ts app/app/layout.tsx
grep -n -A 15 "export function toChatMessage" lib/chat-access.ts

** ---------------------------------------- **

cat lib/ingest.ts app/api/chat/route.ts "app/api/matters/[id]/query/route.ts"

grep -niE "anthropic|voyage|claude|vector\(|embedding" lib/schema.ts components/SearchablePanel.tsx scripts/seed-demo/conversations.ts

grep -nE "anthropic|voyage|openai|\"ai\"" package.json

** ---------------------------------------- **

grep -rnE "VoyageAIClient|anthropic\(" app lib scripts components

** ---------------------------------------- **