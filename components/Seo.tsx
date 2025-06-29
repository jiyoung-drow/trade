import Head from "next/head";

export default function Seo({ title }: { title: string }) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content="안전하고 빠른 경매 거래 플랫폼" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content="안전하고 빠른 경매 거래 플랫폼" />
    </Head>
  );
}
