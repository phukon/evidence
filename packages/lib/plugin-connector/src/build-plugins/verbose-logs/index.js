import { getPagesDir } from './get-pages.js';
import { watchDirectory } from './watcher.js';

/** @type {import("vite").Plugin} */
export const verboseLogs = {
	name: 'evidence:verbose-logs',
  
	buildStart() {
		const directoryPath = '.svelte-kit/output/prerendered/pages';
		getPagesDir('../../pages')
			.then((totalExpectedFiles) => {
				// console.log('Build started');
				watchDirectory(
					directoryPath,
					totalExpectedFiles,
					(/** @type {string} */ progress) => {
						console.log(`Build Progress: ${progress}%`);
					},
					() => {
						console.log('\n All the pages have been built.');
					}
				);
			})
			.catch((error) => {
				console.error('Error:', error);
			});
	}
};
