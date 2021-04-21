# `notion-backup`

> Export [Notion](https://www.notion.so/) pages and subpages to a GitHub repo on a schedule (eg. to be used as a scheduled backup)

## Setup

1. Click on the green "Use this template" button at the top to make your own copy of this repository - make sure to choose "Private" visibility, unless you want to make your Notion content visible to the public
2. Create a new repo secret under Settings -> Secrets called `NOTION_TOKEN` with the instructions in [this article](https://artur-en.medium.com/automated-notion-backups-f6af4edc298d)
3. Edit `index.js` to add the Notion pages you want to export to the `blocks` array at the top of the file
4. Optional: Edit `index.js` to specify a different export format, time zone or locale
5. Optional: Edit `.github/workflows/export-notion-blocks-and-commit.yml` to specify a different schedule (default is once per day)
6. After the action has run, the `exports` folder should contain the content! 🙌

## How

The GitHub Actions workflow is scheduled to run once a day to:

1. export each specified Notion block
2. wait until each export is done
3. download, unzip and commit the content from each export to the repository

## Credit

This script is heavily based on [`notion-guardian`](https://github.com/richartkeil/notion-guardian), thanks to [@richartkeil](https://github.com/richartkeil)!
