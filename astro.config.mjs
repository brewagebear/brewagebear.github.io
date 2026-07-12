// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import { toc } from 'mdast-util-toc';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

// 구 블로그(Gatsby)의 ```toc``` 코드 펜스를 실제 목차 리스트로 치환
function remarkTocFence() {
	return (tree) => {
		tree.children.forEach((node, index) => {
			if (node.type === 'code' && node.lang === 'toc') {
				const result = toc(tree, { maxDepth: 6 });
				tree.children[index] = result.map ?? { type: 'html', value: '' };
			}
		});
	};
}

// https://astro.build/config
export default defineConfig({
	site: 'https://brewagebear.github.io',
	trailingSlash: 'always',
	build: {
    	format: 'directory',
  	},
	i18n: {
    	defaultLocale: 'ko',
    	locales: ['ko', 'en'],
    	routing: {
			prefixDefaultLocale: false, // ko는 주소에 /ko/를 붙이지 않음 (SEO 보호)
		}
  	},
	markdown: {
		remarkPlugins: [remarkTocFence, remarkMath],
		rehypePlugins: [rehypeKatex],
		remarkRehype: {
			footnoteLabel: '각주',
			footnoteLabelTagName: 'h2',
		},
  	},
	integrations: [
		mdx(),
		sitemap({
			// 영어 포스트가 아직 없어 비어 있는 인덱스 페이지들 — 영어 콘텐츠가 생기면 제거
			filter: (page) =>
				![
					'https://brewagebear.github.io/en/',
					'https://brewagebear.github.io/en/posts/',
					'https://brewagebear.github.io/en/tags/',
				].includes(page),
		}),
	],
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
