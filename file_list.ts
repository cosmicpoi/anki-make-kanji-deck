import { k_CHARACTER_LIST_PATH } from "./consts";
import { CharacterType, FileListEntry } from "./types";

export let k_SOURCE_FILE_LIST: FileListEntry[] =
    [
        // All-Character lists
        // {
        //     path: k_CHARACTER_LIST_PATH + '/' + 'Chinese_All.txt',
        //     type: CharacterType.SimplifiedChinese,
        // },

        // {
        //     path: k_CHARACTER_LIST_PATH + '/' + 'Japanese_All.txt',
        //     type: CharacterType.Japanese,
        // },

        
        // HSK entries
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__1.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::6::5::4::3::2::1']
        },
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__2.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::6::5::4::3::2']
        },
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__3.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::6::5::4::3']
        },
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__4.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::6::5::4']
        },
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'HSK__5.txt',
            type: CharacterType.SimplifiedChinese,
            tags: ['HSK::6::5']
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
            tags: ['JLPT::n1::n2']
        }, 
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'JLPT__n3.txt',
            type: CharacterType.Japanese,
            tags: ['JLPT::n1::n2::n3']
        }, 
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'JLPT__n4.txt',
            type: CharacterType.Japanese,
            tags: ['JLPT::n1::n2::n3::n4']
        }, 
        {
            path: k_CHARACTER_LIST_PATH + '/' + 'JLPT__n5.txt',
            type: CharacterType.Japanese,
            tags: ['JLPT::n1::n2::n3::n4::n5']
        }, 
    ];