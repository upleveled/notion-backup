import { execFile } from 'node:child_process';
import { createWriteStream, mkdtempSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import axios from 'axios';
import pMap from 'p-map';

const execFileAsync = promisify(execFile);

const blocks = [
  {
    // Find the page block ID by either:
    // 1. Copying the alphanumeric part at the end of the Notion
    //    page URL and separate it with dashes in the same format
    //    as below (number of characters between dashes:
    //    8-4-4-4-12)
    // 2. Inspecting network requests in the DevTools
    id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    // Find the space ID associated with a block by running this
    // in the DevTools Console while on the page you want to
    // export:
    // ```
    // $('img[src*="spaceId="]').src.replace(/^.+&spaceId=([^&]+)&.+$/, '$1')
    // ```
    spaceId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    // Choose a directory name for your export to appear in the
    // `exports` folder
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

type BlockTask = {
  id: string;
  state: string | null;
  status: {
    pagesExported: number | null;
    exportURL: string | null;
  };
};

type Task = {
  id: string;
  state: string | null;
  status?: {
    pagesExported: number | null;
    exportURL: string | null;
  };
};

for (const [spaceId, spaceBlocks] of Object.entries(
  Object.groupBy(blocks, (block) => block.spaceId),
)) {
  if (!spaceBlocks) continue;

  console.log(
    `Exporting ${spaceBlocks.length} blocks from space ${spaceId}...`,
  );

  const client = axios.create({
    // Notion unofficial API
    baseURL: 'https://www.notion.so/api/v3',
    headers: {
      Cookie: `token_v2=${process.env.NOTION_TOKEN}`,
      'X-Notion-Space-Id': spaceId,
    },
  });

  function delay(ms: number) {
    console.log(
      `Waiting ${ms / 1000} second${ms > 1000 ? 's' : ''} before polling again...`,
    );
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  // Enqueue all export tasks immediately, without waiting for
  // the export tasks to complete
  const enqueuedBlocks = await pMap(spaceBlocks, async (block) => {
    const {
      data: { taskId },
    }: { data: { taskId: string } } = await client.post('enqueueTask', {
      task: {
        eventName: 'exportBlock',
        request: {
          block: {
            id: block.id,
            spaceId: block.spaceId,
          },
          exportOptions: {
            exportType: 'markdown',
            locale: 'en',
            timeZone: 'Europe/Vienna',
          },
          recursive: block.recursive,
        },
      },
    });

    if (!taskId) {
      throw new Error('No taskId returned from enqueueTask');
    }

    console.log(`Started export of block ${block.dirName} as task ${taskId}`);

    const task: BlockTask = {
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

  let retries = 0;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const incompleteEnqueuedBlocks = enqueuedBlocks.filter(
      ({ task }) => task.state !== 'success',
    );

    const taskIds = incompleteEnqueuedBlocks.map(({ task }) => task.id);

    try {
      const {
        data: { results },
        headers: { 'set-cookie': getTasksRequestCookies },
      }: { data: { results: Task[] }; headers: { 'set-cookie': string[] } } =
        await client.post('getTasks', {
          taskIds: taskIds,
        });

      const blocksWithTaskProgress = results.flatMap((task) => {
        const block = enqueuedBlocks.find(({ task: { id } }) => id === task.id);

        if (!block || !task.status) return [];

        // Mutate original object in enqueuedBlocks for while
        // loop exit condition
        if (task.state !== 'success') block.task.state = task.state;
        block.task.status.pagesExported = task.status.pagesExported;
        block.task.status.exportURL = task.status.exportURL;

        return [{ block, state: task.state }];
      });

      for (const { block, state } of blocksWithTaskProgress) {
        if (typeof block.task.status.pagesExported === 'number') {
          console.log(
            `Exported ${block.task.status.pagesExported} pages for ${block.dirName}`,
          );
        }

        if (state === 'success') {
          const backupDirPath = path.join(
            process.cwd(),
            'exports',
            block.dirName,
          );

          console.log(`Export finished for ${block.dirName}`);

          const response = await client<Readable>({
            method: 'GET',
            url: block.task.status.exportURL || undefined,
            responseType: 'stream',
            headers: {
              Cookie: getTasksRequestCookies.find((cookie) =>
                cookie.includes('file_token='),
              ),
            },
          });

          const sizeInMb =
            Number(response.headers['content-length']) / 1000 / 1000;
          console.log(`Downloading ${Math.round(sizeInMb * 1000) / 1000}mb...`);

          const temporaryDirPath = mkdtempSync(`${backupDirPath}-`);
          try {
            const temporaryZipPath = path.join(temporaryDirPath, 'export.zip');
            const extractedDirPath = path.join(temporaryDirPath, 'extracted');
            await pipeline(response.data, createWriteStream(temporaryZipPath));
            await execFileAsync('unzip', [
              '-oq',
              temporaryZipPath,
              '-x',
              '__MACOSX/*',
              '-d',
              extractedDirPath,
            ]);
            rmSync(backupDirPath, { recursive: true, force: true });
            renameSync(extractedDirPath, backupDirPath);
          } finally {
            rmSync(temporaryDirPath, { recursive: true, force: true });
          }

          block.task.state = 'success';
          console.log(`✅ Export of ${block.dirName} downloaded and unzipped`);
        }
      }

      // If all blocks are done, break out of the loop
      if (!enqueuedBlocks.find(({ task }) => task.state !== 'success')) {
        break;
      }

      // Reset retries on success
      retries = 0;
    } catch (error) {
      if (
        !axios.isAxiosError(error) ||
        (error.response?.status && ![429, 502].includes(error.response.status))
      ) {
        // Rethrow errors which do not contain an HTTP 429 or 502
        // status codes
        throw error;
      }

      console.log(
        error.response?.status === 429
          ? 'Received response with HTTP 429 (Too Many Requests), increasing delay...'
          : 'Received response with HTTP 502 (Bad Gateway), increasing delay...',
      );
      retries += 1;
    }

    // Rate limit polling, with incremental backoff
    await delay(1000 + 1000 * retries);
  }
}

console.log('✅ All exports successful');
