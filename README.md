---
title: ChatGPT API
emoji: 🤖
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 8080
pinned: false
license: mit
---

# ChatGPT -> OpenAI-compatible API

OpenAI-compatible endpoint (`/v1/chat/completions`, `/v1/models`, `/v1/responses`,
images, audio, files) backed by your own ChatGPT login.

Point any OpenAI client at the Space URL:

```
OPENAI_BASE_URL=https://<user>-<space>.hf.space/v1
OPENAI_API_KEY=<the Authorization value configured as a Space secret>
```
