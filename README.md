# Bluesky Media Worker

A Cloudflare Worker that turns Bluesky post embeds into rich Open Graph metadata for Discord and other clients. Given a URL shaped like [`/profile/:actor/post/:rkey`](https://wamellow.com/embed/profile/shi.gg/post/3lwbhovlcsc2y) it resolves the handle to a DID, fetches the post thread from the public Bluesky API, and returns an HTML page populated with `<meta>` tags for the attached media.

> [!WARNING]
> Unlike other services, this worker aims to embed media such as images and videos, and the quoted post's content. It will not display the post's content.

The worker was designed to work with [Wamellow's Bluesky x Discord bridge](https://wamellow.com/docs/bluesky), or more specifically, the [Bluesky to Discord notification](https://wamellow.com/docs/notifications).

## Setup

To get started with this project, you'll need to have the following installed:

* [Bun](https://bun.sh/)

    1. **Clone the repository**:
        ```sh
        git clone https://github.com/shi-gg/bluesky-media-worker
        cd bluesky-media-worker
        ```

    2. **Install the dependencies**:
        ```sh
        bun install
        ```

## Developing

To start the development server, run the following command:
```sh
bun run dev
```
This will start the development server on `http://localhost:8787`.

## Deployment

To deploy this worker to Cloudflare, you'll need to have the following installed:

* [Cloudflare CLI](https://developers.cloudflare.com/workers/cli/)

**Deploy the worker**:
```sh
bunx wrangler deploy
```