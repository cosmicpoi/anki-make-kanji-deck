import { k_CHARACTER_LIST_PATH } from "./consts";
import { CharacterType, FileListEntry } from "./types";

export let k_SOURCE_FILE_LIST: FileListEntry[] =
    [
        // HSK entries
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__1.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::1']
        },
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__2.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::2']
        },
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__3.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::3']
        },
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__4.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::4']
        },
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__5.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::5']
        },
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__6.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::6']
        },
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__7-9.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::7-9']
        },
        // JLPT entries
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'JLPT__n1.txt',
            type: CharacterType.Japanese,
            tags: ['JLPT::n1']
        }, 
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'JLPT__n2.txt',
            type: CharacterType.Japanese,
            tags: ['JLPT::n2']
        }, 
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'JLPT__n3.txt',
            type: CharacterType.Japanese,
            tags: ['JLPT::n3']
        }, 
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'JLPT__n4.txt',
            type: CharacterType.Japanese,
            tags: ['JLPT::n4']
        }, 
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'JLPT__n5.txt',
            type: CharacterType.Japanese,
            tags: ['JLPT::n5']
        }, 
    ];