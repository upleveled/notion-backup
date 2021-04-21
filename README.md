# `notion-backup`

> Export [Notion](https://www.notion.so/) pages and subpages to a GitHub repo on a schedule (eg. to be used as a scheduled backup)

## Setup

1. Fork this repository and make your fork private
2. Edit `index.js` to add the Notion pages you want to export to the `blocks` array at the top of the file
3. Optional: Edit `index.js` to specify a different export format, time zone or locale
4. Create a new repo secret called `NOTION_TOKEN` with the instructions in [this article](https://artur-en.medium.com/automated-notion-backups-f6af4edc298d)
5. Click on the Actions tab at the top and enable actions
6. On the left sidebar click the "Export Notion Blocks and Commit to Git" workflow and enable Scheduled Actions (there should be a notification that they are disabled)
7. After the action has run, check the `exports` folder to verify that the action is running correctly

## How

The GitHub Actions workflow is scheduled to run once a day to:

1. export each specified Notion block
2. wait until each export is done
3. download, unzip and commit the content from each export to the repository

## Credit

This script is heavily based on [`notion-guardian`](https://github.com/richartkeil/notion-guardian) by [@richartkeil](https://github.com/richartkeil).
