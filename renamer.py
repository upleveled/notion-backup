from os import popen, path, walk, rename
from re import match

EXPORTS_PATH = 'exports'
FILE_PATTERN = r'^.* [0-9a-fA-F]{32}\..*$'
DIR_PATTERN = r'^.* [0-9a-fA-F]{32}'


def update_links(old_name, new_name, name_hex):
    old_link = old_name.replace(' ', '%20')
    new_name = new_name.replace(' ', '%20')
    ptr_files = popen(f"grep {name_hex} {EXPORTS_PATH} -R -l").read().splitlines()

    if ptr_files:
        print(f'\tUpdating links from: {old_name} -> {new_name}')

    for ptr_file in ptr_files:
        print(f'\t\tupdate links in {ptr_file} ')
        p = popen(f'sed -i "s/{old_link}/{new_name}/g" "{ptr_file}"')
        p.close()


def rename_entity(entity_type, root, entity_list, pattern, name_extractor):
    counter = {}
    updated_entities = []
    for entity in entity_list:
        if match(pattern, entity):
            entity_hex = entity.split(' ')[-1].split('.')[0]
            new_name = name_extractor(entity)
            
            if new_name in counter:
                counter[new_name] += 1
                basename, ext = path.splitext(new_name)
                new_name = f"{basename} {counter[new_name]}{ext}" if entity_type == 'file' else f"{new_name} {counter[new_name]}"
            else:
                counter[new_name] = 1

            updated_entities.append(new_name)
            old_path = path.join(root, entity)
            new_path = path.join(root, new_name)
            rename(old_path, new_path)
            print(f'\n{entity_type}: {entity} => {new_name}')
            update_links(entity, new_name, entity_hex)

    return updated_entities


def rename_recursive(directory):
    for root, dirs, files in walk(directory):
        print(f'\n=============== current directory: {root} ===============\n')
        _ = rename_entity('file', root, files, FILE_PATTERN,
                            lambda name: name.replace(f" {name.split(' ')[-1].split('.')[0]}", ''))
        updated_dirs = rename_entity('directory', root, dirs, DIR_PATTERN, lambda name: ' '.join(name.split(' ')[:-1]))

        for updated_dir in updated_dirs:
            rename_recursive(path.join(root, updated_dir))


rename_recursive(EXPORTS_PATH)
