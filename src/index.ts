import { Client, simpleFetchHandler } from '@atcute/client';
import { AppBskyEmbedRecordWithMedia, AppBskyFeedDefs, AppBskyFeedPost } from '@atcute/bluesky';
import { Did, is, type ResourceUri } from '@atcute/lexicons';
import template from '../assets/template.html';

type PostWithRecord = AppBskyFeedDefs.PostView & { record: AppBskyFeedPost.Main };
type PostResult =
    | { status: 'ok'; post: PostWithRecord }
    | { status: 'not-found' }
    | { status: 'error' };
type MetaResult =
    | { status: 'ok'; tags: string[] }
    | { status: 'not-found' }
    | { status: 'error' };

const HTML_HEADERS = { 'Content-Type': 'text/html' };
const POST_PATTERN = new URLPattern({ pathname: '/profile/:actor/post/:rkey' });

const client = new Client({
    handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }),
});

export default {
    async fetch(request): Promise<Response> {
        const url = request.url.includes("/embed/")
            ? new URL(request.url.replace("/embed/", "/"))
            : new URL(request.url);

        const route = POST_PATTERN.exec(url);
        const actor = route?.pathname.groups.actor;
        const rkey = route?.pathname.groups.rkey;

        if (!actor || !rkey) return invalidUrl();

        const did = await resolveDid(actor);
        if (!did) return serverError();

        const postUri: ResourceUri = `at://${did}/app.bsky.feed.post/${rkey}`;
        const postResult = await fetchPostView(postUri);
        if (postResult.status === 'error') return serverError();
        if (postResult.status === 'not-found') return notFound();

        const metaResult = await buildMetaTags(postResult.post);
        if (metaResult.status === 'error') return serverError();
        if (metaResult.status === 'not-found') return notFound();

        if (url.searchParams.get('redirect') || metaResult.tags.some(tag => tag.includes('og:video'))) {
            const tag = metaResult.tags.find(tag => tag.includes('og:video') || tag.includes('og:image'));
            const mediaUrl = tag?.split('content="')[1]?.split('"')[0];
            if (mediaUrl) {
                return Response.redirect(mediaUrl, 302);
            }
        }

        return renderTemplate({
            did,
            rkey,
            meta: metaResult.tags
        });
    },
} satisfies ExportedHandler<Env>;

const meta = (property: string, content: string) => `<meta property="${property}" content="${content}">`;

const renderTemplate = ({ did, rkey, meta }: { did: string; rkey: string; meta: string[] }) => {
    return new Response(
        template
            .replaceAll('{{username}}', did)
            .replaceAll('{{id}}', rkey)
            .replace('<!-- template -->', meta.join('\n')),
        { headers: HTML_HEADERS },
    );
};

const invalidUrl = () => new Response("Invalid URL", { status: 400 });
const serverError = () => new Response("Internal Server Error", { status: 500 });
const notFound = () => new Response("Not Found", { status: 404 });

const mediaMeta = (
    embed:
        | AppBskyFeedDefs.PostView['embed']
        | AppBskyEmbedRecordWithMedia.View['media']
        | undefined,
    did: Did
): string[] => {
    switch (embed?.$type) {
        case 'app.bsky.embed.images#view': return embed.images.map((image) => meta('og:image', image.thumb));
        case 'app.bsky.embed.video#view': return [meta('og:video', `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${embed.cid}`)];
        default: return [];
    }
};

const quoteMeta = (post: PostWithRecord, did: Did) => {
    const tags = [
        meta('og:title', `${post.author.displayName ?? post.author.handle} (${post.author.handle})`),
    ];

    if (post.record.text) {
        tags.push(meta('og:description', post.record.text));
    }

    return [...tags, ...mediaMeta(post.embed, did)];
};

async function buildMetaTags(post: PostWithRecord): Promise<MetaResult> {
    const embed = post.embed;

    switch (embed?.$type) {
        case 'app.bsky.embed.images#view':
        case 'app.bsky.embed.video#view':
            return { status: 'ok', tags: mediaMeta(embed, post.author.did) };

        case 'app.bsky.embed.record#view': {
            const quoteUri = embed.record.uri as ResourceUri;
            const quote = await fetchPostView(quoteUri);
            return quote.status === 'ok' ? { status: 'ok', tags: quoteMeta(quote.post, post.author.did) } : quote;
        }

        case 'app.bsky.embed.recordWithMedia#view': {
            const quoteUri = embed.record.record.uri as ResourceUri;
            const quote = await fetchPostView(quoteUri);
            if (quote.status !== 'ok') return quote;

            return {
                status: 'ok',
                tags: [...quoteMeta(quote.post, post.author.did), ...mediaMeta(embed.media, post.author.did)],
            };
        }

        default:
            return { status: 'not-found' };
    }
}

async function fetchPostView(uri: ResourceUri): Promise<PostResult> {
    const { ok, data } = await client.get('app.bsky.feed.getPostThread', {
        params: { uri, depth: 0, parentHeight: 0 },
    });

    if (!ok) return { status: 'error' };
    if (data.thread.$type !== 'app.bsky.feed.defs#threadViewPost') return { status: 'not-found' };
    if (!is(AppBskyFeedPost.mainSchema, data.thread.post.record)) return { status: 'not-found' };

    return { status: 'ok', post: data.thread.post as PostWithRecord };
}

async function resolveDid(actor: string) {
    if (actor.startsWith('did:')) return actor;

    const { ok, data } = await client.get('com.atproto.identity.resolveHandle', {
        params: { handle: actor as `${string}.${string}` },
    });

    if (!ok || !data.did) return null;
    return data.did;
}
