export const k_GUESS_STRING = '(guess❓)';

export const k_CHARACTER_LIST_PATH: string = 'lists/characters';
export const k_WORD_LIST_PATH: string = 'lists/words'

const k_DATA_DIR = "data";
const k_DATA = (s: string): string => k_DATA_DIR + "/" + s;

export const k_UNIHAN_DB_PATH: string = k_DATA('Unihan');
export const k_KANJIDIC_FILE_PATH: string = k_DATA('kanjidic2.xml');
export const k_HANZIDB_FILE_PATH: string = k_DATA('hanzi_db.csv');
export const k_CEDICT_FILE_PATH: string = k_DATA('cedict_ts.u8');
export const k_JMDICT_FILE_PATH: string = k_DATA('JMdict_e');
export const k_BCCWJ_FILE_PATH: string = k_DATA('BCCWJ_frequencylist_suw_ver1_0.tsv');
export const k_BCLU_FILE_PATH: string = k_DATA('bclu.txt');
export const k_SUBTLEX_FILE_PATH: string = k_DATA('SUBTLEX-CH-WF.csv');


export const k_HSK_FILE_LIST: string[] = [
    'HSK_1.txt',
    'HSK_2.txt',
    'HSK_3.txt',
    'HSK_4.txt',
    'HSK_5.txt',
    'HSK_6.txt',
];

export const k_JLPT_FILE_LIST: string[] = [
    'JLPT_N5.txt',
    'JLPT_N4.txt',
    'JLPT_N3.txt',
    'JLPT_N2.txt',
    'JLPT_N1.txt',
];

export const k_JOYO_FILE_PATH = "Joyo_all.txt";
export const k_JINMEIYO_FILE_PATH ="Jinmeiyo.txt";

export const k_NUM_KANGXI_RADICALS = 214;

export const k_tag_HSK = "HSK";
export const k_tag_HSK_7_9 = "HSK::7-9";

export const k_tag_CHINESE_ONLY = "chinese_only";
export const k_tag_CHINESE_RARE = "chinese_rare";
export const k_tag_JAPANESE_ONLY = "japanese_only";
export const k_tag_JAPANESE_RARE = "japanese_rare";
export const k_tag_JINMEIYO = "jinmeiyou_kanji";
export const k_tag_JOYO = "jouyou_kanji";
export const k_tag_RADICAL = "radical";
export const k_tag_USUALLY_KANA = "usually_kana";

export const k_tag_LANG_SLANG = "language::slang";
export const k_tag_LANG_VULGAR = "language::vulgar";
export const k_tag_LANG_ARCHAIC = "language::archaic";
export const k_tag_LANG_OBSELETE = "language::archaic";

export const k_note_CN_JP = "Character Sino-Japanese";
export const k_note_CHINESE_ONLY = "Character Chinese";
export const k_note_JAPANESE_ONLY = "Character Japanese";
export const k_note_VOCAB_CHINESE = "Vocab Chinese";
export const k_note_VOCAB_JAPANESE = "Vocab Japanese";