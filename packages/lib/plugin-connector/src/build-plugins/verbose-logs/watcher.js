import fs from 'fs';
import path from 'path';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { waitForDirectoryCreation } from './wait-creation.js';
import { countDirectories } from './countDir.js';
import os from 'os';
const { tmpdir: tempDir } = os;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Returns the list of template directories to be watched.
 * @param {string} targetDirectory - The target directory to search for template pages.
 * @param {Array<string>} templatePagePaths - The relative paths to the template pages.
 * @returns {Promise<Set<string>>} - A Set of directory paths to watch.
 */
const dirWatchList = async (targetDirectory, templatePagePaths) => {
	const dirToWatch = new Set();
	for (const templatePath of templatePagePaths) {
		if (fs.existsSync(targetDirectory + templatePath)) {
			dirToWatch.add(targetDirectory + templatePath);
		}
	}
	return dirToWatch;
};

	let CHILD_READY_FLAG = false;
	// @ts-ignore
	let timeout;

	/**
	 * Resets the timeout to 15 seconds.
	 * The timer will only start after the target directory has been
	 * created, therefore the process will not be killed prematurely.
	 */
	// const resetTimeout = () => {
	// 	// @ts-ignore
	// 	clearTimeout(timeout);
	// 	timeout = setTimeout(() => {
	// 		console.log('No activity detected for over 10 seconds. Killing process...');
	// 		process.exit(1);
	// 	}, 15_000);
	// };

  	/**
	 * Ensures that a directory exists, creating it if it doesn't.
	 * @param {string} directory - The path to the directory to ensure.
	 */
	const ensureDirectoryExists = (directory) => {
		if (!fs.existsSync(directory)) {
			fs.mkdirSync(directory, { recursive: true });
		}
	};


/**
 * Watches a directory and calculates the progress of files being added.
 * @param {string} directoryPath - The path to the directory to watch.
 * @param {Set<string>} dirs - The set of directories to watch.
 */
export async function watchDirectory(directoryPath, dirs) {
	const targetDirectory = path.resolve(__dirname, directoryPath);
	await waitForDirectoryCreation(directoryPath);

	// Directory paths for log file
	const logsDirectory = path.join(tempDir(), 'evidence-logs');
	ensureDirectoryExists(logsDirectory);
	const stdoutLogPath = path.join(logsDirectory, 'stdout.log');
	const stdoutLog = fs.createWriteStream(stdoutLogPath);
	stdoutLog.on('error', (err) => {
		console.error('Error writing to stdout.log:', err);
	});

	// Redirect stdout and stderr to log files
	console.log('Redirecting stdout and stderr...\n ctrl + c to safely exit');
	// @ts-ignore
	process.stdout.write = process.stderr.write = stdoutLog.write.bind(stdoutLog);
	console.log('Stream redirection setup complete.');

	// Fork the terminal-ui.js process
	const blessedAppProcess = fork(
		path.resolve(
			'../../node_modules/@evidence-dev/plugin-connector/dist/terminal-ui/terminal-ui.cjs'
		)
	);

	// Handle messages from the forked process
	// @ts-ignore
	blessedAppProcess.on('message', ({ type }) => {
		if (type === 'childReady') {
			CHILD_READY_FLAG = true;
		}
	});

	// @ts-ignore
	blessedAppProcess.on('message', ({ type, result }) => {
		console.log(`Message from childprocess:\n type: ${type} \nmessage: ${result}`);
	});

	try {
		const pathArrays = Array.from(dirs).map((p) => {
			const pathArray = p.split(path.sep);
			pathArray.pop(); // removing the template page name
			return pathArray.slice(3); // removing target dir top paths
		});

		const joinedPaths = pathArrays.map((p) => path.sep + path.join(...p));
		const watchList = await dirWatchList(targetDirectory, joinedPaths);

		// @ts-ignore
		blessedAppProcess.on('message', ({ type }) => {
			if (type === 'childReady') {
				const updatedOptions = [...joinedPaths, ' ', 'Quit'];
				blessedAppProcess.send({ type: 'config', configArray: updatedOptions });
			}
		});

		const watchers = [];

		for (const dir of watchList) {
			const watcher = chokidar.watch(dir, { ignoreInitial: true, depth: 0 });
			watchers.push(watcher);

			watcher.on('addDir', async () => {
				// resetTimeout();
				let count = await countDirectories(dir);
        CHILD_READY_FLAG && blessedAppProcess.send({ type: 'dataFromParent', count, dir });
			});
		}
	} catch (err) {
		console.error('Error:', err);
		return;
	}
}
