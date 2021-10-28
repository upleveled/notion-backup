import { createWriteStream, mkdirSync, rmSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import extract from 'extract-zip';
import pMap from 'p-map';

const blocks = [
  {
    // Find the page block ID by either:
    // 1. Copying the alphanumeric part at the end of the Notion page URL
    //    and separate it with dashes in the same format as below
    //    (number of characters between dashes: 8-4-4-4-12)
    // 2. Inspecting network requests in the DevTools
    id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    // Choose a directory name for your export to appear in the `exports` folder
    dirName: 'notion-page-a',
    // Should all of the subpages also be exported?
    recursive: false,
  },
];

if (!process.env.NOTION_TOKEN) {
  console.error(
    'Environment variable NOTION_TOKEN is missing. Check the README.md for more information.',
  );
  process.exit(1);
}

/**
 * @typedef {{
 *   id: string;
 *   state: string | null;
 *   status: {
 *     pagesExported: number | null;
 *     exportURL: string | null;
 *   };
 * }} BlockTask
 */

/**
 * @typedef {{
 *   id: string;
 *   state: string | null;
 *   status?: {
 *     pagesExported: number | null;
 *     exportURL: string | null;
 *   };
 * }} Task
 */

const client = axios.create({
  // Notion unofficial API
  baseURL: 'https://www.notion.so/api/v3',
  headers: {
    Cookie: `token_v2=${process.env.NOTION_TOKEN}`,
  },
});

function delay(/** @type {number} */ ms) {
  console.log(`Waiting ${ms / 1000} second before polling again...`);
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Enqueue all export tasks immediately, without
// waiting for the export tasks to complete
const enqueuedBlocks = await pMap(blocks, async (block) => {
  /** @type {{ data: { taskId: string } }} */
  const {
    data: { taskId },
  } = await client.post('enqueueTask', {
    task: {
      eventName: 'exportBlock',
      request: {
        blockId: block.id,
        exportOptions: {
          exportType: 'markdown',
          locale: 'en',
          timeZone: 'Europe/Vienna',
        },
        recursive: block.recursive,
      },
    },
  });

  console.log(`Started export of block ${block.dirName} as task ${taskId}`);

  /** @type {BlockTask} */
  const task = {
    id: taskId,
    state: null,
    status: {
      pagesExported: null,
      exportURL: null,
    },
  };

  return {
    ...block,
    task: task,
  };
});

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
while (true) {
  const incompleteEnqueuedBlocks = enqueuedBlocks.filter(
    ({ task }) => task.state !== 'success',
  );

  const taskIds = incompleteEnqueuedBlocks.map(({ task }) => task.id);

  /** @type {{ data: { results: Task[] } }} */
  const {
    data: { results },
  } = await client.post('getTasks', {
    taskIds: taskIds,
  });

  const blocksWithTaskProgress = results.reduce(
    (
      /** @type {typeof incompleteEnqueuedBlocks} */ blocksAcc,
      /** @type {Task} */ task,
    ) => {
      const block = enqueuedBlocks.find(({ task: { id } }) => id === task.id);

      if (!block || !task.status) return blocksAcc;

      // Mutate original object in enqueuedBlocks for while loop exit condition
      block.task.state = task.state;
      block.task.status.pagesExported = task.status.pagesExported;
      block.task.status.exportURL = task.status.exportURL;

      return blocksAcc.concat(block);
    },
    /** @type {typeof incompleteEnqueuedBlocks} */ [],
  );

  for (const block of blocksWithTaskProgress) {
    console.log(
      `Exported ${block.task.status.pagesExported} pages for ${block.dirName}`,
    );

    if (block.task.state === 'success') {
      const backupDirPath = path.join(process.cwd(), 'exports', block.dirName);

      const temporaryZipPath = path.join(
        process.cwd(),
        'exports',
        `${block.dirName}.zip`,
      );

      console.log(`Export finished for ${block.dirName}`);

      /** @type {import('axios').AxiosResponse<import('node:stream').Stream>} */
      const response =
        // We need this cast because of how axios@0.22.0 and axios@0.23.0 are typed
        // https://github.com/axios/axios/issues/4176
        await client({
          method: 'GET',
          url: block.task.status.exportURL || undefined,
          responseType: 'stream',
        });

      const sizeInMb = Number(response.headers['content-length']) / 1000 / 1000;
      console.log(`Downloading ${Math.round(sizeInMb * 1000) / 1000}mb...`);

      const stream = response.data.pipe(createWriteStream(temporaryZipPath));

      await new Promise((resolve, reject) => {
        stream.on('close', resolve);
        stream.on('error', reject);
      });

      rmSync(backupDirPath, { recursive: true, force: true });
      mkdirSync(backupDirPath, { recursive: true });
      await extract(temporaryZipPath, { dir: backupDirPath });
      unlinkSync(temporaryZipPath);

      console.log(`✅ Export of ${block.dirName} downloaded and unzipped`);
    }
  }

  // If all blocks are done, break out of the loop
  if (!enqueuedBlocks.find(({ task }) => task.state !== 'success')) {
    break;
  }

  // Rate limit polling
  await delay(1000);
}

console.log('✅ All exports successful');
