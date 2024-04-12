const blessed = require('blessed');
const path = require('path');


/**
 * Global store to hold counts for each directory.
 *
 * @typedef {Object.<string, number>} DirectoryCounts
 */

/** @type {DirectoryCounts} */
const directoryCounts = {};

/**
 * @type {string | number | NodeJS.Timeout | undefined}
 */
let timeout;

/**
 * Resets the timeout to 20 seconds.
 * This is added as a redundancy in case the child process runs in a detached mode
 * and doesn't die on the parent being killed.
 */
function resetTimeout() {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    logMessage('No activity detected for over 10 seconds. Killing process...');
    process.exit(1);
  }, 20_000);
}

/**
 * Creates a blessed screen with a menu box and a log box.
 */
const screen = blessed.screen({
  smartCSR: true,
  title: 'Terminal Interface',
});

const menuBox = blessed.box({
  parent: screen,
  width: '80%',
  height: '100%',
  border: {
    type: 'line',
  },
  style: {
    fg: 'white',
    border: {
      fg: 'white',
    },
  },
});

const menu = blessed.list({
  parent: menuBox,
  top: 'center',
  left: 'center',
  width: '90%',
  height: '90%',
  align: 'center',
  tags: true,
  keys: true,
  border: {
    type: 'line',
  },
  style: {
    selected: {
      bg: 'yellow',
      bold: true,
    },
  },
  items: ['Use the', 'arrow keys', 'to move'],
});

menuBox.pushLine('\t\tTemplate pages');

const logBox = blessed.box({
  parent: screen,
  left: '80%',
  width: '20%',
  height: '80%',
  border: {
    type: 'line',
  },
  scrollbar: {
    ch: ' '
  },
  style: {
    fg: 'white',
    bg: 'black',
    border: {
      fg: 'white',
    },
  },
});

const totalBox = blessed.box({
  parent: screen,
  top: '80%',
  left: '80%',
  width: '20%',
  height: '20%',
  border: {
    type: 'line',
  },
  scrollbar: {
    ch: ' '
  },
  style: {
    fg: 'white',
    bg: 'black',
    border: {
      fg: 'white',
    },
  },
});

/**
 * Logs a message to the log box and renders the screen.
 * @param {string} message - The message to log.
 */
function logMessage(message) {
  logBox.setContent('');
  logBox.pushLine(message);
  screen.render();
}

/**
 * Event handler for menu selection.
 * If the selected item is 'Quit', the process exits.
 * Otherwise, it logs the selected route and the number of pages built for that route.
 * @param {object} item - The selected menu item.
 */
menu.on('select', (item) => {
  if (item.content === 'Quit') {
    return process.exit(0);
  }
  logMessage(`\nSelected route:\n ${item.content}`);
  const count = directoryCounts[item.content];
  if (count !== undefined) {
    logMessage(`\nPages built for \n ${item.content}\n\n > ${count}`);
  } else {
    logMessage(`\nPages built for \n ${item.content}\n\n > 0`);
  }
});

// Handle Escape or Q to quit
screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

// Initial log message
logBox.pushLine('\n(Use arrow keys to navigate the menu)');
logBox.pushLine('Total pages built: ');
totalBox.pushLine('building pages...');
totalBox.pushLine(`\nTotal built: ${calculateSumCounts(directoryCounts)}`);

/**
 * Calculates the sum of all the values in the directoryCounts object.
 * @param {DirectoryCounts} countsObject - The object containing the directory counts.
 * @returns {number} - The sum of all the counts.
 */
function calculateSumCounts(countsObject) {
  let sum = 0;
  for (const key in countsObject) {
    if (Object.prototype.hasOwnProperty.call(countsObject, key)) {
      sum += countsObject[key];
    }
  }
  return sum;
}

/**
 * Handles messages from the parent process.
 * If the message type is 'dataFromParent', it updates the directoryCounts object
 * and the total pages built display.
 * If the message type is 'config', it updates the menu items.
 * @param {object} message - The message from the parent process.
 */
process.on('message', ({ type, count, dir }) => {
  resetTimeout();
  if (type === 'dataFromParent') {
    const shortenedPath = path.relative(__dirname, dir);
    const newPathArray = shortenedPath.split(path.sep);
    const newPath = path.sep + path.join(...newPathArray.slice(4));
    directoryCounts[newPath] = count;
    totalBox.setContent('');
    totalBox.pushLine('\nbuilding pages...');
    totalBox.pushLine(`\nTotal built: ${calculateSumCounts(directoryCounts)}`);
    screen.render();
    // @ts-ignore
    process.send({
      type: 'dataProcessed',
      result: 'Data processed successfully',
    });
  }
});

process.on('message', ({ type, configArray }) => {
  if (type === 'config') {
    console.log(`Received data from parent ${configArray}`);
    menu.clearItems();
    menu.setItems(configArray);
    screen.render();
    // @ts-ignore
    process.send({
      type: 'dataProcessed',
      result: 'Config updated successfully',
    });
  }
});

// Focus on the menu to enable keyboard navigation
menu.focus();
screen.render();
// @ts-ignore
process.send({ type: 'childReady' });