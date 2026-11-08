This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

# CHECK STRIPE -- NPM RUN CHECK:STRIPE

make notes for this

grep -rn "already pays through Stripe" . --exclude-dir=node_modules --exclude-dir=.next
grep -rn "APP_URL" . --exclude-dir=node_modules --exclude-dir=.next
grep -rn "dark" . --exclude-dir=node_modules --exclude-dir=.next

git status
git check-ignore -v .env.local
git log --all --oneline -- .env.local

openssl rand -hex 32

#1 stripe listen --print-secret
#2 stripe listen \

# --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted \

# --forward-to localhost:3000/api/stripe/webhook

grep -rn "toLocaleDateString()\|toLocaleString()" app components

npx tsc --noEmit

grep -rnE "toLocale(Date|Time)?String\(|Intl\.DateTimeFormat|longDate" app components lib

google:
Enabled: - Maps JavaScript API - Places API
installed: npm install @vis.gl/react-google-maps

npm install tsx:

- Because chat server is written in TypeScript, and Node.js can’t run our TypeScript on its own.
- "chat:start": "tsx chat-server/index.ts",

API KEY:
AIzaSyD9m1icRcl1jE_Fg76wMxqudpH8oSGHmQI

Todo:

- set up a limit on the billing account
-

<!-- moved over  -->

npm install --save-prod tsx @clerk/backend
--save-prod (or -P) means “put these in dependencies”, which moves them there if they’re currently in devDependencies.
Why @clerk/backend too

    Look at your devDependencies: @clerk/backend is in there as well. The chat server needs it to run:

# installed the types for google on AddressAutoComplete

- npm install -D @types/google.maps
-D (dev dependency) is right this time: type definitions are only used by TypeScript while you write and build. They’re deleted from the running code, so the live site never needs them. (The opposite case from tsx, which the chat server needs at runtime.)


 npx tsc --noEmit
 this checks to see the type errors 
 