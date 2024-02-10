# `notion-backup`

> Export [Notion](https://www.notion.so/) pages and subpages to a GitHub repo on a schedule (eg. to be used as a scheduled backup)

## Setup

1. Click on the green "Use this template" button at the top to make your own copy of this repository - make sure to choose "Private" visibility, unless you want to make your Notion content visible to the public
2. Under Settings -> Actions -> General -> Workflow, scroll down to the Workflow Permissions section and select `Read and write permissions` (this is to allow the Actions workflow to write your Notion content to your repo)
3. Under Settings -> Secrets and Variables -> Actions, create a new repository secret called `NOTION_TOKEN` with the instructions in [this article](https://archive.ph/b5mgg) ([original Medium article](https://artur-en.medium.com/automated-notion-backups-f6af4edc298d))
4. Edit `index.ts` to add the Notion pages you want to export to the `blocks` array at the top of the file
5. Optional: Edit `index.ts` to specify a different export format, time zone or locale
6. Optional: Edit `.github/workflows/export-notion-blocks-and-commit.yml` to specify a different schedule (default is once per day)
7. After the `Export Notion Blocks and Commit to Git` workflow has run, your backup will have been committed to your GitHub repo in the `exports` folder! 🙌

## How

The GitHub Actions workflow is scheduled to run once a day to:

1. export each specified Notion block
2. wait until each export is done
3. download, unzip and commit the content from each export to the repository

## Notion Backup Enhancer

Overview

The "Notion Backup Enhancer" is a Python script designed to enhance the organization and readability of your Notion backup files and directories. It addresses the following key features:

- Human-Readable Naming: The script renames all files and directories within your Notion backup to human-friendly names, making it easier to understand and navigate your backup structure.
- Link Editing: It updates links within your Notion content to reflect the renamed files and directories. This ensures that your links remain valid and functional after the renaming process.
- Handling Repeated Names: In cases where there are duplicate names in your backup, the script appends a unique identifier to the filenames, preventing naming conflicts and maintaining data integrity.

**[Notion Backup Enhancer](https://github.com/juba0x00/notion-backup-enhancer)**
### Before Enhancer
![Before Enhancer](https://github.com/juba0x00/notion-backup-enhanced-pr/assets/73611543/3e8989a4-db43-41f9-887e-0c298f9b7e8e)
### After Enhancer
![After Enhancer](https://github.com/juba0x00/notion-backup-enhanced-pr/assets/73611543/7758b27d-2806-4dd0-8e35-c4cf3c7a3ca0)

## Credit

This script is heavily based on [`notion-guardian`](https://github.com/richartkeil/notion-guardian), thanks to [@richartkeil](https://github.com/richartkeil)!
