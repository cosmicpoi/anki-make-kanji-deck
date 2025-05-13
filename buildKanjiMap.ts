import * as fs from 'fs'
import { Unihan } from './unihan';
import { Kanjidic } from './kanjidic';
import { KanjiMap } from './KanjiMap';
import { Cedict } from './cedict';
import { k_CEDICT_FILE_PATH, k_CHARACTER_LIST_PATH, k_JLPT_FILE_LIST, k_note_CHINESE_ONLY, k_note_CN_JP, k_note_JAPANESE_ONLY, k_tag_CHINESE_ONLY, k_tag_JAPANESE_ONLY } from './consts';
import * as OpenCC from 'opencc-js';
import { TieredWordList } from './TieredWordList';
import { VariantMap } from './VariantMap';

export function buildKanjiMapFromFileLists(
    props: {
        fileListDir: string,
        japaneseList: string[],
        simpChineseList: string[],
        modules: {
            unihan: Unihan,
            kanjidic: Kanjidic,
            cedict: Cedict
        }
    }
): KanjiMap {
    // initialize kanji map
    let kanji: KanjiMap = new KanjiMap();

    // Initialize resources
    const { unihan, kanjidic, cedict } = props.modules;
    const converter_t2s = OpenCC.Converter({ from: 'hk', to: 'cn' });
    const converter_s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });

    // Initialize tiers
    const japaneseTiers = new TieredWordList(props.fileListDir, props.japaneseList);
    const chineseTiers = new TieredWordList(props.fileListDir, props.simpChineseList);

    // Emplace chars into Kanji Map
    const variantMap = new VariantMap(unihan, japaneseTiers.getAllChars(), chineseTiers.getAllChars(), true);
    variantMap.writeToFile('variant.txt');
    // Merge duplicate entries
    
    return kanji;
}

