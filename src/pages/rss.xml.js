import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	const posts = (await getCollection('blog')).sort(
		(a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
	);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => {
			const isEn = post.id.startsWith('en/');
			const slug = post.id
				.replace(/^(ko|en)\//, '')
				.replace(/\/index\.md$/, '')
				.replace(/\.md$/, '');

			return {
				title: post.data.title,
				description: post.data.description,
				pubDate: post.data.date,
				link: isEn ? `/en/${slug}/` : `/${slug}/`,
			};
		}),
	});
}
